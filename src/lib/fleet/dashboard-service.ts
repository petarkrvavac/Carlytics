import { createOptionalServerSupabaseClient } from "@/lib/supabase/server";
import { createOptionalServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import {
  applyInterventionVisibilityFilter,
  isInterventionInProgress,
  isInterventionOpen,
} from "@/lib/fleet/intervention-utils";
import { MOCK_DASHBOARD_DATA } from "@/lib/fleet/mock-dashboard-data";
import { evaluateVehicleServiceDue } from "@/lib/fleet/service-due";
import type {
  AlertSeverity,
  CostSeriesPoint,
  CriticalAlert,
  DashboardData,
  FleetHealthSummary,
  VehicleListItem,
  VehicleStatus,
} from "@/lib/fleet/types";
import type { Tables } from "@/types/database";

const DAYS_FOR_REGISTRATION_ALERT = 30;
const MONTH_BUCKET_COUNT = 6;

const HR_MONTH_LABELS = [
  "Sij",
  "Velj",
  "Ožu",
  "Tra",
  "Svi",
  "Lip",
  "Srp",
  "Kol",
  "Ruj",
  "Lis",
  "Stu",
  "Pro",
] as const;

function getServiceRiskTier(serviceDueKm: number) {
  if (serviceDueKm < 0) {
    return 0;
  }

  if (serviceDueKm === 0) {
    return 1;
  }

  return 2;
}

type VehicleRow = Pick<
  Tables<"vozila">,
  | "id"
  | "broj_sasije"
  | "model_id"
  | "status_id"
  | "trenutna_km"
  | "datum_kupovine"
  | "godina_proizvodnje"
  | "is_aktivan"
  | "mjesto_id"
  | "nabavna_vrijednost"
  | "razlog_deaktivacije"
  | "zadnji_mali_servis_datum"
  | "zadnji_mali_servis_km"
  | "zadnji_veliki_servis_datum"
  | "zadnji_veliki_servis_km"
>;
type ModelRow = Pick<
  Tables<"modeli">,
  | "id"
  | "naziv"
  | "proizvodjac_id"
  | "kapacitet_rezervoara"
  | "tip_goriva_id"
  | "mali_servis_interval_km"
  | "veliki_servis_interval_km"
>;
type ManufacturerRow = Pick<Tables<"proizvodjaci">, "id" | "naziv">;
type FuelTypeRow = Pick<Tables<"tipovi_goriva">, "id" | "naziv">;
type StatusRow = Pick<Tables<"statusi_vozila">, "id" | "naziv">;
type PlaceRow = Pick<Tables<"mjesta">, "id" | "naziv">;
type RegistrationRow = Pick<Tables<"registracije">, "vozilo_id" | "registracijska_oznaka" | "datum_isteka">;
type FuelRow = Pick<Tables<"evidencija_goriva">, "datum" | "ukupni_iznos" | "cijena_po_litri" | "litraza">;
type ServiceRow = Pick<Tables<"servisne_intervencije">, "datum_zavrsetka" | "cijena">;
type FaultRow = Pick<
  Tables<"servisne_intervencije">,
  "id" | "vozilo_id" | "status_prijave" | "hitnost" | "opis" | "datum_pocetka" | "datum_zavrsetka"
>;
type AssignmentRow = Pick<Tables<"zaduzenja">, "vozilo_id" | "is_aktivno">;

function toMonthKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function normalizeLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function getDaysUntil(isoDate: string | null | undefined) {
  const date = parseDate(isoDate);

  if (!date) {
    return null;
  }

  const now = new Date();
  const midnightNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const midnightTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffMs = midnightTarget.getTime() - midnightNow.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function normalizeStatus(label: string | null | undefined): VehicleStatus {
  if (!label) {
    return "Na servisu";
  }

  const normalized = label.toLowerCase();

  if (normalized.includes("serv")) {
    return "Na servisu";
  }

  if (normalized.includes("zau") || normalized.includes("vozn") || normalized.includes("duz")) {
    return "Zauzeto";
  }

  return "Slobodno";
}

function resolveVehicleStatus(params: {
  statusLabel: string | null | undefined;
  hasInProgressIntervention: boolean;
  hasActiveAssignment: boolean;
}): VehicleStatus {
  if (params.hasInProgressIntervention) {
    return "Na servisu";
  }

  if (params.hasActiveAssignment) {
    return "Zauzeto";
  }

  return normalizeStatus(params.statusLabel);
}

function normalizeFaultSeverity(hitnost: string | null): AlertSeverity {
  if (!hitnost) {
    return "upozorenje";
  }

  const normalized = hitnost.toLowerCase();

  if (normalized.includes("krit") || normalized.includes("high") || normalized.includes("hitno")) {
    return "kriticno";
  }

  if (normalized.includes("low") || normalized.includes("nisko")) {
    return "info";
  }

  return "upozorenje";
}

function getMonthBuckets(months: number): CostSeriesPoint[] {
  const now = new Date();
  const buckets: CostSeriesPoint[] = [];

  for (let index = months - 1; index >= 0; index -= 1) {
    const bucketDate = new Date(now.getFullYear(), now.getMonth() - index, 1);

    buckets.push({
      monthKey: toMonthKey(bucketDate),
      monthLabel: HR_MONTH_LABELS[bucketDate.getMonth()],
      fuelCost: 0,
      serviceCost: 0,
    });
  }

  return buckets;
}

function getLatestRegistrations(registrations: RegistrationRow[]) {
  const grouped = new Map<number, RegistrationRow[]>();

  for (const row of registrations) {
    if (!row.vozilo_id) {
      continue;
    }

    const existing = grouped.get(row.vozilo_id) ?? [];
    existing.push(row);
    grouped.set(row.vozilo_id, existing);
  }

  const latestByVehicle = new Map<number, RegistrationRow>();

  for (const [vehicleId, entries] of grouped) {
    entries.sort((a, b) => {
      const aDate = parseDate(a.datum_isteka)?.getTime() ?? 0;
      const bDate = parseDate(b.datum_isteka)?.getTime() ?? 0;
      return bDate - aDate;
    });

    const latest = entries[0];

    if (latest) {
      latestByVehicle.set(vehicleId, latest);
    }
  }

  return latestByVehicle;
}

function mapLocationByCity(places: PlaceRow[]) {
  const cityById = new Map<number, string>();

  for (const place of places) {
    const cityLabel = normalizeLabel(place.naziv);

    if (cityLabel) {
      cityById.set(place.id, cityLabel);
    }
  }

  return cityById;
}

function mapVehicles(params: {
  vehicles: VehicleRow[];
  models: ModelRow[];
  manufacturers: ManufacturerRow[];
  fuelTypes: FuelTypeRow[];
  statuses: StatusRow[];
  places: PlaceRow[];
  registrations: RegistrationRow[];
  openInterventionCountByVehicle: Map<number, number>;
  inProgressInterventionVehicleIds: Set<number>;
  assignedVehicleIds: Set<number>;
}) {
  const modelById = new Map(params.models.map((model) => [model.id, model]));
  const manufacturerById = new Map(
    params.manufacturers.map((manufacturer) => [manufacturer.id, manufacturer]),
  );
  const fuelTypeById = new Map(params.fuelTypes.map((fuelType) => [fuelType.id, fuelType]));
  const statusById = new Map(params.statuses.map((status) => [status.id, status]));
  const cityById = mapLocationByCity(params.places);
  const latestRegistrationByVehicle = getLatestRegistrations(params.registrations);

  const mappedVehicles = params.vehicles.map<VehicleListItem>((vehicle) => {
    const model = vehicle.model_id ? modelById.get(vehicle.model_id) : null;
    const manufacturer = model?.proizvodjac_id
      ? manufacturerById.get(model.proizvodjac_id)
      : null;
    const statusLabel = vehicle.status_id
      ? statusById.get(vehicle.status_id)?.naziv
      : null;
    const registration = latestRegistrationByVehicle.get(vehicle.id);
    const isActive = vehicle.is_aktivan !== false;
    const hasInProgressIntervention = params.inProgressInterventionVehicleIds.has(vehicle.id);
    const hasActiveAssignment = params.assignedVehicleIds.has(vehicle.id);
    const cityLabel = vehicle.mjesto_id ? (cityById.get(vehicle.mjesto_id) ?? null) : null;

    const currentKm = vehicle.trenutna_km ?? 0;
    const serviceDue = evaluateVehicleServiceDue({
      currentKm,
      lastSmallServiceKm: vehicle.zadnji_mali_servis_km,
      lastLargeServiceKm: vehicle.zadnji_veliki_servis_km,
      smallServiceIntervalKm: model?.mali_servis_interval_km,
      largeServiceIntervalKm: model?.veliki_servis_interval_km,
      lastSmallServiceDate: vehicle.zadnji_mali_servis_datum ?? vehicle.datum_kupovine,
      lastLargeServiceDate: vehicle.zadnji_veliki_servis_datum ?? vehicle.datum_kupovine,
    });

    return {
      id: vehicle.id,
      make: manufacturer?.naziv ?? "Nepoznato",
      model: model?.naziv ?? "Nepoznati model",
      plate: registration?.registracijska_oznaka ?? `V-${vehicle.id}`,
      km: currentKm,
      fuelCapacity: model?.kapacitet_rezervoara ?? 0,
      fuelTypeLabel: model?.tip_goriva_id
        ? (fuelTypeById.get(model.tip_goriva_id)?.naziv ?? null)
        : null,
      serviceDueKm: serviceDue.serviceDueKm,
      serviceDueType: serviceDue.serviceDueType,
      serviceDueLabel: serviceDue.serviceDueLabel,
      serviceProgressIntervalKm: serviceDue.serviceProgressIntervalKm,
      isServiceDue: serviceDue.isServiceDue,
      status: resolveVehicleStatus({
        statusLabel,
        hasInProgressIntervention,
        hasActiveAssignment,
      }),
      registrationExpiryDays: getDaysUntil(registration?.datum_isteka),
      registrationExpiryDateIso: registration?.datum_isteka ?? null,
      openFaultCount: params.openInterventionCountByVehicle.get(vehicle.id) ?? 0,
      isActive,
      deactivationReason: vehicle.razlog_deaktivacije ?? null,
      vin: vehicle.broj_sasije,
      acquisitionValue: vehicle.nabavna_vrijednost,
      productionYear: vehicle.godina_proizvodnje,
      registrationCity: cityLabel,
      locationCity: cityLabel,
      lastSmallServiceDate: vehicle.zadnji_mali_servis_datum,
      lastSmallServiceKm: vehicle.zadnji_mali_servis_km,
      lastLargeServiceDate: vehicle.zadnji_veliki_servis_datum,
      lastLargeServiceKm: vehicle.zadnji_veliki_servis_km,
    };
  });

  mappedVehicles.sort((left, right) => {
    if (left.isActive !== right.isActive) {
      return left.isActive ? -1 : 1;
    }

    const leftTier = getServiceRiskTier(left.serviceDueKm);
    const rightTier = getServiceRiskTier(right.serviceDueKm);

    if (leftTier !== rightTier) {
      return leftTier - rightTier;
    }

    if (left.serviceDueKm !== right.serviceDueKm) {
      return left.serviceDueKm - right.serviceDueKm;
    }

    const leftReg = left.registrationExpiryDays ?? Number.MAX_SAFE_INTEGER;
    const rightReg = right.registrationExpiryDays ?? Number.MAX_SAFE_INTEGER;

    return leftReg - rightReg;
  });

  return mappedVehicles;
}

function buildFleetHealth(vehicles: VehicleListItem[]): FleetHealthSummary {
  const activeVehicles = vehicles.filter((vehicle) => vehicle.isActive);
  const total = activeVehicles.length;
  const inService = activeVehicles.filter((vehicle) => vehicle.status === "Na servisu").length;
  const occupied = activeVehicles.filter((vehicle) => vehicle.status === "Zauzeto").length;
  const operational = total - inService;

  return {
    total,
    operational,
    occupied,
    inService,
    percentage: total > 0 ? Math.round((operational / total) * 100) : 0,
  };
}

function buildCostSeries(fuelRows: FuelRow[], serviceRows: ServiceRow[]) {
  const buckets = getMonthBuckets(MONTH_BUCKET_COUNT);
  const bucketByKey = new Map(buckets.map((bucket) => [bucket.monthKey, bucket]));

  for (const fuel of fuelRows) {
    const date = parseDate(fuel.datum);

    if (!date) {
      continue;
    }

    const key = toMonthKey(date);
    const bucket = bucketByKey.get(key);

    if (!bucket) {
      continue;
    }

    const total = fuel.ukupni_iznos ?? fuel.cijena_po_litri * fuel.litraza;
    bucket.fuelCost += total;
  }

  for (const service of serviceRows) {
    // U trošak servisa ulaze samo završene intervencije i to po mjesecu završetka.
    const date = parseDate(service.datum_zavrsetka);

    if (!date) {
      continue;
    }

    const key = toMonthKey(date);
    const bucket = bucketByKey.get(key);

    if (!bucket) {
      continue;
    }

    bucket.serviceCost += service.cijena ?? 0;
  }

  return buckets.map((bucket) => ({
    ...bucket,
    fuelCost: Math.round(bucket.fuelCost),
    serviceCost: Math.round(bucket.serviceCost),
  }));
}

function severityRank(severity: AlertSeverity) {
  if (severity === "kriticno") {
    return 0;
  }

  if (severity === "upozorenje") {
    return 1;
  }

  return 2;
}

function resolveServiceAlertTitle(vehicle: VehicleListItem) {
  if (vehicle.serviceDueType === "mali") {
    return "Mali servis je potreban";
  }

  if (vehicle.serviceDueType === "veliki") {
    return "Veliki servis je potreban";
  }

  return "Mali i veliki servis su potrebni";
}

function buildCriticalAlerts(vehicles: VehicleListItem[], faultRows: FaultRow[]) {
  const alerts: CriticalAlert[] = [];
  const nowIso = new Date().toISOString();

  for (const vehicle of vehicles) {
    if (!vehicle.isActive) {
      continue;
    }

    if (
      vehicle.registrationExpiryDays !== null &&
      vehicle.registrationExpiryDays <= DAYS_FOR_REGISTRATION_ALERT
    ) {
      const isExpired = vehicle.registrationExpiryDays < 0;

      alerts.push({
        id: `registracija-${vehicle.id}`,
        type: "registracija",
        title: isExpired ? "Registracija je istekla" : "Registracija uskoro ističe",
        description: isExpired
          ? `${vehicle.plate} je istekla prije ${Math.abs(vehicle.registrationExpiryDays)} dana.`
          : `${vehicle.plate} ističe za ${vehicle.registrationExpiryDays} dana.`,
        severity:
          isExpired || vehicle.registrationExpiryDays <= 3 ? "kriticno" : "upozorenje",
        createdAtIso: nowIso,
      });
    }

    if (vehicle.isServiceDue) {
      const serviceDescription = `${vehicle.make} ${vehicle.model}: ${vehicle.serviceDueLabel}.`;

      alerts.push({
        id: `servis-${vehicle.id}`,
        type: "servis",
        title: resolveServiceAlertTitle(vehicle),
        description: serviceDescription,
        severity: "kriticno",
        createdAtIso: nowIso,
      });
    }
  }

  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

  for (const fault of faultRows) {
    if (!isInterventionOpen(fault.status_prijave, fault.datum_zavrsetka)) {
      continue;
    }

    if (isInterventionInProgress(fault.status_prijave)) {
      continue;
    }

    const vehicle = fault.vozilo_id ? vehicleById.get(fault.vozilo_id) : null;

    if (vehicle && !vehicle.isActive) {
      continue;
    }

    alerts.push({
      id: `kvar-${fault.id}`,
      type: "kvar",
      title: "Nova prijava kvara",
      description: vehicle
        ? `${vehicle.plate}: ${fault.opis?.trim() || "Bez opisa"}`
        : `Prijava #${fault.id}: ${fault.opis?.trim() || "Bez opisa"}`,
      severity: normalizeFaultSeverity(fault.hitnost),
      createdAtIso: fault.datum_pocetka,
    });
  }

  alerts.sort((left, right) => {
    const severityDiff = severityRank(left.severity) - severityRank(right.severity);

    if (severityDiff !== 0) {
      return severityDiff;
    }

    const leftDate = parseDate(left.createdAtIso)?.getTime() ?? 0;
    const rightDate = parseDate(right.createdAtIso)?.getTime() ?? 0;

    return rightDate - leftDate;
  });

  return alerts.slice(0, 12);
}

function getFallbackData() {
  return {
    ...MOCK_DASHBOARD_DATA,
    vehicles: [...MOCK_DASHBOARD_DATA.vehicles],
    costSeries: [...MOCK_DASHBOARD_DATA.costSeries],
    criticalAlerts: [...MOCK_DASHBOARD_DATA.criticalAlerts],
  };
}

interface DashboardDataOptions {
  vehicleLimit?: number;
}

export async function getDashboardData(
  options: DashboardDataOptions = {},
): Promise<DashboardData> {
  const vehicleLimit = options.vehicleLimit ?? 8;
  const serviceRoleClient = createOptionalServiceRoleSupabaseClient();
  const client = serviceRoleClient ?? createOptionalServerSupabaseClient();

  if (!client) {
    return getFallbackData();
  }

  try {
    const [
      vehiclesResult,
      modelsResult,
      manufacturersResult,
      fuelTypesResult,
      statusesResult,
      placesResult,
      registrationsResult,
      assignmentsResult,
      fuelResult,
      serviceResult,
      faultsResult,
    ] = await Promise.all([
      client
        .from("vozila")
        .select(
          "id, broj_sasije, model_id, status_id, trenutna_km, datum_kupovine, godina_proizvodnje, is_aktivan, mjesto_id, nabavna_vrijednost, razlog_deaktivacije, zadnji_mali_servis_datum, zadnji_mali_servis_km, zadnji_veliki_servis_datum, zadnji_veliki_servis_km",
        ),
      client
        .from("modeli")
        .select(
          "id, naziv, proizvodjac_id, kapacitet_rezervoara, tip_goriva_id, mali_servis_interval_km, veliki_servis_interval_km",
        ),
      client.from("proizvodjaci").select("id, naziv"),
      client.from("tipovi_goriva").select("id, naziv"),
      client.from("statusi_vozila").select("id, naziv"),
      client.from("mjesta").select("id, naziv"),
      client
        .from("registracije")
        .select("vozilo_id, registracijska_oznaka, datum_isteka"),
      client.from("zaduzenja").select("vozilo_id, is_aktivno"),
      client
        .from("evidencija_goriva")
        .select("datum, ukupni_iznos, cijena_po_litri, litraza"),
      applyInterventionVisibilityFilter(
        client.from("servisne_intervencije").select("datum_zavrsetka, cijena"),
      ),
      applyInterventionVisibilityFilter(
        client
          .from("servisne_intervencije")
          .select("id, vozilo_id, status_prijave, hitnost, opis, datum_pocetka, datum_zavrsetka"),
      ),
    ] as const);

    const queryError = [
      vehiclesResult.error,
      modelsResult.error,
      manufacturersResult.error,
      fuelTypesResult.error,
      statusesResult.error,
      placesResult.error,
      registrationsResult.error,
      assignmentsResult.error,
      fuelResult.error,
      serviceResult.error,
      faultsResult.error,
    ].find((error) => Boolean(error));

    if (queryError) {
      throw queryError;
    }

    const faultRows = (faultsResult.data ?? []) as FaultRow[];
    const openInterventionCountByVehicle = new Map<number, number>();
    const inProgressInterventionVehicleIds = new Set<number>();

    for (const fault of faultRows) {
      if (!fault.vozilo_id || !isInterventionOpen(fault.status_prijave, fault.datum_zavrsetka)) {
        continue;
      }

      const currentCount = openInterventionCountByVehicle.get(fault.vozilo_id) ?? 0;
      openInterventionCountByVehicle.set(fault.vozilo_id, currentCount + 1);

      if (isInterventionInProgress(fault.status_prijave)) {
        inProgressInterventionVehicleIds.add(fault.vozilo_id);
      }
    }

    const assignments = (assignmentsResult.data ?? []) as AssignmentRow[];
    const assignedVehicleIds = new Set<number>();

    for (const assignment of assignments) {
      if (assignment.vozilo_id && assignment.is_aktivno) {
        assignedVehicleIds.add(assignment.vozilo_id);
      }
    }

    const vehicles = mapVehicles({
      vehicles: vehiclesResult.data ?? [],
      models: modelsResult.data ?? [],
      manufacturers: manufacturersResult.data ?? [],
      fuelTypes: fuelTypesResult.data ?? [],
      statuses: statusesResult.data ?? [],
      places: placesResult.data ?? [],
      registrations: registrationsResult.data ?? [],
      openInterventionCountByVehicle,
      inProgressInterventionVehicleIds,
      assignedVehicleIds,
    });

    const fleetHealth = buildFleetHealth(vehicles);
    const costSeries = buildCostSeries(
      (fuelResult.data ?? []) as FuelRow[],
      (serviceResult.data ?? []) as ServiceRow[],
    );

    const criticalAlerts = buildCriticalAlerts(vehicles, faultRows);
    let lastUpdatedIso = new Date().toISOString();

    const { data: recentEventData, error: recentEventError } = await client
      .from("app_events")
      .select("kreirano_u")
      .in("izvorna_tablica", ["evidencija_goriva", "servisne_intervencije", "zaduzenja"])
      .order("kreirano_u", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentEventError) {
      console.warn("[carlytics] app_events timestamp fallback:", recentEventError.message);
    } else if (recentEventData?.kreirano_u) {
      lastUpdatedIso = recentEventData.kreirano_u;
    }

    return {
      fleetHealth,
      costSeries,
      criticalAlerts,
      criticalAlertCount: criticalAlerts.filter((alert) => alert.severity === "kriticno").length,
      vehicles: vehicles.slice(0, vehicleLimit),
      activeFaultCount: vehicles.reduce(
        (count, vehicle) => count + (vehicle.isActive ? vehicle.openFaultCount : 0),
        0,
      ),
      lastUpdatedIso,
      isUsingFallbackData: false,
    };
  } catch (error) {
    console.error("[carlytics] Dashboard fallback zbog greške:", error);
    if (!serviceRoleClient) {
      console.error(
        "[carlytics] SUPABASE_SERVICE_ROLE_KEY nije postavljen; anon čitanje može biti ograničeno RLS pravilima.",
      );
    }
    return getFallbackData();
  }
}

export async function getFleetVehiclesSnapshot() {
  const serviceRoleClient = createOptionalServiceRoleSupabaseClient();
  const client = serviceRoleClient ?? createOptionalServerSupabaseClient();

  if (!client) {
    return [...MOCK_DASHBOARD_DATA.vehicles];
  }

  try {
    const [
      vehiclesResult,
      modelsResult,
      manufacturersResult,
      fuelTypesResult,
      statusesResult,
      placesResult,
      registrationsResult,
      assignmentsResult,
      faultsResult,
    ] = await Promise.all([
      client
        .from("vozila")
        .select(
          "id, broj_sasije, model_id, status_id, trenutna_km, datum_kupovine, godina_proizvodnje, is_aktivan, mjesto_id, nabavna_vrijednost, razlog_deaktivacije, zadnji_mali_servis_datum, zadnji_mali_servis_km, zadnji_veliki_servis_datum, zadnji_veliki_servis_km",
        ),
      client
        .from("modeli")
        .select(
          "id, naziv, proizvodjac_id, kapacitet_rezervoara, tip_goriva_id, mali_servis_interval_km, veliki_servis_interval_km",
        ),
      client.from("proizvodjaci").select("id, naziv"),
      client.from("tipovi_goriva").select("id, naziv"),
      client.from("statusi_vozila").select("id, naziv"),
      client.from("mjesta").select("id, naziv"),
      client
        .from("registracije")
        .select("vozilo_id, registracijska_oznaka, datum_isteka"),
      client.from("zaduzenja").select("vozilo_id, is_aktivno"),
      applyInterventionVisibilityFilter(
        client
          .from("servisne_intervencije")
          .select("id, vozilo_id, status_prijave, hitnost, opis, datum_pocetka, datum_zavrsetka"),
      ),
    ] as const);

    const queryError = [
      vehiclesResult.error,
      modelsResult.error,
      manufacturersResult.error,
      fuelTypesResult.error,
      statusesResult.error,
      placesResult.error,
      registrationsResult.error,
      assignmentsResult.error,
      faultsResult.error,
    ].find((error) => Boolean(error));

    if (queryError) {
      throw queryError;
    }

    const faultRows = (faultsResult.data ?? []) as FaultRow[];
    const openInterventionCountByVehicle = new Map<number, number>();
    const inProgressInterventionVehicleIds = new Set<number>();

    for (const fault of faultRows) {
      if (!fault.vozilo_id || !isInterventionOpen(fault.status_prijave, fault.datum_zavrsetka)) {
        continue;
      }

      const currentCount = openInterventionCountByVehicle.get(fault.vozilo_id) ?? 0;
      openInterventionCountByVehicle.set(fault.vozilo_id, currentCount + 1);

      if (isInterventionInProgress(fault.status_prijave)) {
        inProgressInterventionVehicleIds.add(fault.vozilo_id);
      }
    }

    const assignments = (assignmentsResult.data ?? []) as AssignmentRow[];
    const assignedVehicleIds = new Set<number>();

    for (const assignment of assignments) {
      if (assignment.vozilo_id && assignment.is_aktivno) {
        assignedVehicleIds.add(assignment.vozilo_id);
      }
    }

    return mapVehicles({
      vehicles: (vehiclesResult.data ?? []) as VehicleRow[],
      models: (modelsResult.data ?? []) as ModelRow[],
      manufacturers: (manufacturersResult.data ?? []) as ManufacturerRow[],
      fuelTypes: (fuelTypesResult.data ?? []) as FuelTypeRow[],
      statuses: (statusesResult.data ?? []) as StatusRow[],
      places: (placesResult.data ?? []) as PlaceRow[],
      registrations: (registrationsResult.data ?? []) as RegistrationRow[],
      openInterventionCountByVehicle,
      inProgressInterventionVehicleIds,
      assignedVehicleIds,
    });
  } catch (error) {
    console.error("[carlytics] Fleet snapshot fallback zbog greške:", error);
    if (!serviceRoleClient) {
      console.error(
        "[carlytics] SUPABASE_SERVICE_ROLE_KEY nije postavljen; anon čitanje može biti ograničeno RLS pravilima.",
      );
    }
    return [...MOCK_DASHBOARD_DATA.vehicles];
  }
}

export async function getAppShellMetrics() {
  const serviceRoleClient = createOptionalServiceRoleSupabaseClient();
  const client = serviceRoleClient ?? createOptionalServerSupabaseClient();

  if (!client) {
    return {
      activeFaultCount: MOCK_DASHBOARD_DATA.activeFaultCount,
      hasCriticalAlerts: MOCK_DASHBOARD_DATA.criticalAlertCount > 0,
    };
  }

  try {
    const [faultsResult, vehiclesResult, modelsResult, registrationsResult] = await Promise.all([
      applyInterventionVisibilityFilter(
        client.from("servisne_intervencije").select("vozilo_id, status_prijave, hitnost, datum_zavrsetka"),
      ),
      client
        .from("vozila")
        .select(
          "id, model_id, trenutna_km, datum_kupovine, zadnji_mali_servis_datum, zadnji_mali_servis_km, zadnji_veliki_servis_datum, zadnji_veliki_servis_km, is_aktivan",
        ),
      client
        .from("modeli")
        .select(
          "id, naziv, proizvodjac_id, kapacitet_rezervoara, mali_servis_interval_km, veliki_servis_interval_km",
        ),
      client
        .from("registracije")
        .select("vozilo_id, registracijska_oznaka, datum_isteka"),
    ] as const);

    const queryError = [
      faultsResult.error,
      vehiclesResult.error,
      modelsResult.error,
      registrationsResult.error,
    ].find((error) => Boolean(error));

    if (queryError) {
      throw queryError;
    }

    const vehicles = (vehiclesResult.data ?? []) as VehicleRow[];
    const activeVehicleIds = new Set(
      vehicles.filter((vehicle) => vehicle.is_aktivan !== false).map((vehicle) => vehicle.id),
    );

    const faultRows = (faultsResult.data ?? []) as Array<
      Pick<FaultRow, "vozilo_id" | "status_prijave" | "hitnost" | "datum_zavrsetka">
    >;
    const activeFaultCount = faultRows.filter(
      (fault) => {
        if (!fault.vozilo_id) {
          return false;
        }

        return (
          activeVehicleIds.has(fault.vozilo_id) &&
          isInterventionOpen(fault.status_prijave, fault.datum_zavrsetka)
        );
      },
    ).length;
    const hasCriticalFault = faultRows.some(
      (fault) => {
        if (!fault.vozilo_id) {
          return false;
        }

        return (
          activeVehicleIds.has(fault.vozilo_id) &&
          isInterventionOpen(fault.status_prijave, fault.datum_zavrsetka) &&
          !isInterventionInProgress(fault.status_prijave) &&
          normalizeFaultSeverity(fault.hitnost) === "kriticno"
        );
      },
    );

    const latestRegistrationByVehicle = getLatestRegistrations(
      (registrationsResult.data ?? []) as RegistrationRow[],
    );
    const hasExpiringRegistration = Array.from(latestRegistrationByVehicle.values()).some(
      (registration) => {
        if (!registration.vozilo_id || !activeVehicleIds.has(registration.vozilo_id)) {
          return false;
        }

        const daysUntilExpiry = getDaysUntil(registration.datum_isteka);
        return daysUntilExpiry !== null && daysUntilExpiry <= DAYS_FOR_REGISTRATION_ALERT;
      },
    );

    const modelById = new Map(
      ((modelsResult.data ?? []) as ModelRow[]).map((model) => [model.id, model]),
    );
    const hasServiceOverdue = vehicles.some((vehicle) => {
      if (!activeVehicleIds.has(vehicle.id)) {
        return false;
      }

      const model = vehicle.model_id ? modelById.get(vehicle.model_id) : null;
      const serviceDue = evaluateVehicleServiceDue({
        currentKm: vehicle.trenutna_km,
        lastSmallServiceKm: vehicle.zadnji_mali_servis_km,
        lastLargeServiceKm: vehicle.zadnji_veliki_servis_km,
        smallServiceIntervalKm: model?.mali_servis_interval_km,
        largeServiceIntervalKm: model?.veliki_servis_interval_km,
        lastSmallServiceDate: vehicle.zadnji_mali_servis_datum ?? vehicle.datum_kupovine,
        lastLargeServiceDate: vehicle.zadnji_veliki_servis_datum ?? vehicle.datum_kupovine,
      });

      return serviceDue.isServiceDue;
    });

    return {
      activeFaultCount,
      hasCriticalAlerts: hasCriticalFault || hasExpiringRegistration || hasServiceOverdue,
    };
  } catch (error) {
    console.error("[carlytics] App shell metrike fallback zbog greške:", error);
    if (!serviceRoleClient) {
      console.error(
        "[carlytics] SUPABASE_SERVICE_ROLE_KEY nije postavljen; anon čitanje može biti ograničeno RLS pravilima.",
      );
    }
    return {
      activeFaultCount: MOCK_DASHBOARD_DATA.activeFaultCount,
      hasCriticalAlerts: MOCK_DASHBOARD_DATA.criticalAlertCount > 0,
    };
  }
}
