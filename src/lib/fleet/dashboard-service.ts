import { createOptionalServerSupabaseClient } from "@/lib/supabase/server";
import { createOptionalServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import { MOCK_DASHBOARD_DATA } from "@/lib/fleet/mock-dashboard-data";
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

const DAYS_FOR_CRITICAL_REGISTRATION = 10;
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

const OPEN_FAULT_HINTS = ["novo", "otvor", "cek", "ceka", "obrada", "pending", "active"];
const CLOSED_FAULT_HINTS = ["zatvor", "rijes", "rije", "closed", "resolved", "done"];

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
  "id" | "model_id" | "status_id" | "trenutna_km" | "zadnji_mali_servis_km"
>;
type ModelRow = Pick<
  Tables<"modeli">,
  "id" | "naziv" | "proizvodjac_id" | "kapacitet_rezervoara" | "mali_servis_interval_km"
>;
type ManufacturerRow = Pick<Tables<"proizvodjaci">, "id" | "naziv">;
type StatusRow = Pick<Tables<"statusi_vozila">, "id" | "naziv">;
type RegistrationRow = Pick<Tables<"registracije">, "vozilo_id" | "registracijska_oznaka" | "datum_isteka">;
type FuelRow = Pick<Tables<"evidencija_goriva">, "datum" | "ukupni_iznos" | "cijena_po_litri" | "litraza">;
type ServiceRow = Pick<Tables<"servisne_intervencije">, "datum_zavrsetka" | "cijena">;
type FaultRow = Pick<
  Tables<"prijave_kvarova">,
  "id" | "vozilo_id" | "status_prijave" | "hitnost" | "opis_problema" | "datum_prijave"
>;

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

function isFaultOpen(status: string | null) {
  if (!status) {
    return true;
  }

  const normalized = status.toLowerCase();

  if (CLOSED_FAULT_HINTS.some((hint) => normalized.includes(hint))) {
    return false;
  }

  if (OPEN_FAULT_HINTS.some((hint) => normalized.includes(hint))) {
    return true;
  }

  return true;
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

function mapVehicles(params: {
  vehicles: VehicleRow[];
  models: ModelRow[];
  manufacturers: ManufacturerRow[];
  statuses: StatusRow[];
  registrations: RegistrationRow[];
  openFaultCountByVehicle: Map<number, number>;
}) {
  const modelById = new Map(params.models.map((model) => [model.id, model]));
  const manufacturerById = new Map(
    params.manufacturers.map((manufacturer) => [manufacturer.id, manufacturer]),
  );
  const statusById = new Map(params.statuses.map((status) => [status.id, status]));
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

    const currentKm = vehicle.trenutna_km ?? 0;
    const lastSmallServiceKm = vehicle.zadnji_mali_servis_km ?? 0;
    const smallServiceIntervalKm = model?.mali_servis_interval_km ?? 15000;
    const serviceDueKm = smallServiceIntervalKm - (currentKm - lastSmallServiceKm);

    return {
      id: vehicle.id,
      make: manufacturer?.naziv ?? "Nepoznato",
      model: model?.naziv ?? "Nepoznati model",
      plate: registration?.registracijska_oznaka ?? `V-${vehicle.id}`,
      km: currentKm,
      fuelCapacity: model?.kapacitet_rezervoara ?? 0,
      serviceDueKm,
      status: normalizeStatus(statusLabel),
      registrationExpiryDays: getDaysUntil(registration?.datum_isteka),
      openFaultCount: params.openFaultCountByVehicle.get(vehicle.id) ?? 0,
    };
  });

  mappedVehicles.sort((left, right) => {
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
  const total = vehicles.length;
  const inService = vehicles.filter((vehicle) => vehicle.status === "Na servisu").length;
  const occupied = vehicles.filter((vehicle) => vehicle.status === "Zauzeto").length;
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

function buildCriticalAlerts(vehicles: VehicleListItem[], faultRows: FaultRow[]) {
  const alerts: CriticalAlert[] = [];
  const nowIso = new Date().toISOString();

  for (const vehicle of vehicles) {
    if (
      vehicle.registrationExpiryDays !== null &&
      vehicle.registrationExpiryDays >= 0 &&
      vehicle.registrationExpiryDays <= DAYS_FOR_CRITICAL_REGISTRATION
    ) {
      alerts.push({
        id: `registracija-${vehicle.id}`,
        type: "registracija",
        title: "Registracija uskoro ističe",
        description: `${vehicle.plate} ističe za ${vehicle.registrationExpiryDays} dana.`,
        severity: vehicle.registrationExpiryDays <= 3 ? "kriticno" : "upozorenje",
        createdAtIso: nowIso,
      });
    }

    if (vehicle.serviceDueKm <= 0) {
      const serviceDescription =
        vehicle.serviceDueKm < 0
          ? `${vehicle.make} ${vehicle.model} je prekoračio servis za ${Math.abs(vehicle.serviceDueKm)} km.`
          : `${vehicle.make} ${vehicle.model} je dosegnuo servisni interval. Servis je potreban odmah.`;

      alerts.push({
        id: `servis-${vehicle.id}`,
        type: "servis",
        title: "Vozilo je ušlo u servisnu zonu",
        description: serviceDescription,
        severity: "kriticno",
        createdAtIso: nowIso,
      });
    }
  }

  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

  for (const fault of faultRows) {
    if (!isFaultOpen(fault.status_prijave)) {
      continue;
    }

    const vehicle = fault.vozilo_id ? vehicleById.get(fault.vozilo_id) : null;

    alerts.push({
      id: `kvar-${fault.id}`,
      type: "kvar",
      title: "Nova prijava kvara",
      description: vehicle
        ? `${vehicle.plate}: ${fault.opis_problema}`
        : `Prijava #${fault.id}: ${fault.opis_problema}`,
      severity: normalizeFaultSeverity(fault.hitnost),
      createdAtIso: fault.datum_prijave ?? nowIso,
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
      statusesResult,
      registrationsResult,
      fuelResult,
      serviceResult,
      faultsResult,
    ] = await Promise.all([
      client
        .from("vozila")
        .select("id, model_id, status_id, trenutna_km, zadnji_mali_servis_km"),
      client
        .from("modeli")
        .select("id, naziv, proizvodjac_id, kapacitet_rezervoara, mali_servis_interval_km"),
      client.from("proizvodjaci").select("id, naziv"),
      client.from("statusi_vozila").select("id, naziv"),
      client
        .from("registracije")
        .select("vozilo_id, registracijska_oznaka, datum_isteka"),
      client
        .from("evidencija_goriva")
        .select("datum, ukupni_iznos, cijena_po_litri, litraza"),
      client.from("servisne_intervencije").select("datum_zavrsetka, cijena"),
      client
        .from("prijave_kvarova")
        .select("id, vozilo_id, status_prijave, hitnost, opis_problema, datum_prijave"),
    ] as const);

    const queryError = [
      vehiclesResult.error,
      modelsResult.error,
      manufacturersResult.error,
      statusesResult.error,
      registrationsResult.error,
      fuelResult.error,
      serviceResult.error,
      faultsResult.error,
    ].find((error) => Boolean(error));

    if (queryError) {
      throw queryError;
    }

    const faultRows = (faultsResult.data ?? []) as FaultRow[];
    const openFaultCountByVehicle = new Map<number, number>();

    for (const fault of faultRows) {
      if (!fault.vozilo_id || !isFaultOpen(fault.status_prijave)) {
        continue;
      }

      const currentCount = openFaultCountByVehicle.get(fault.vozilo_id) ?? 0;
      openFaultCountByVehicle.set(fault.vozilo_id, currentCount + 1);
    }

    const vehicles = mapVehicles({
      vehicles: vehiclesResult.data ?? [],
      models: modelsResult.data ?? [],
      manufacturers: manufacturersResult.data ?? [],
      statuses: statusesResult.data ?? [],
      registrations: registrationsResult.data ?? [],
      openFaultCountByVehicle,
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
      .in("izvorna_tablica", ["evidencija_goriva", "prijave_kvarova", "zaduzenja"])
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
      activeFaultCount: faultRows.filter((fault) => isFaultOpen(fault.status_prijave)).length,
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
      statusesResult,
      registrationsResult,
      faultsResult,
    ] = await Promise.all([
      client
        .from("vozila")
        .select("id, model_id, status_id, trenutna_km, zadnji_mali_servis_km"),
      client
        .from("modeli")
        .select("id, naziv, proizvodjac_id, kapacitet_rezervoara, mali_servis_interval_km"),
      client.from("proizvodjaci").select("id, naziv"),
      client.from("statusi_vozila").select("id, naziv"),
      client
        .from("registracije")
        .select("vozilo_id, registracijska_oznaka, datum_isteka"),
      client
        .from("prijave_kvarova")
        .select("id, vozilo_id, status_prijave, hitnost, opis_problema, datum_prijave"),
    ] as const);

    const queryError = [
      vehiclesResult.error,
      modelsResult.error,
      manufacturersResult.error,
      statusesResult.error,
      registrationsResult.error,
      faultsResult.error,
    ].find((error) => Boolean(error));

    if (queryError) {
      throw queryError;
    }

    const faultRows = (faultsResult.data ?? []) as FaultRow[];
    const openFaultCountByVehicle = new Map<number, number>();

    for (const fault of faultRows) {
      if (!fault.vozilo_id || !isFaultOpen(fault.status_prijave)) {
        continue;
      }

      const currentCount = openFaultCountByVehicle.get(fault.vozilo_id) ?? 0;
      openFaultCountByVehicle.set(fault.vozilo_id, currentCount + 1);
    }

    return mapVehicles({
      vehicles: (vehiclesResult.data ?? []) as VehicleRow[],
      models: (modelsResult.data ?? []) as ModelRow[],
      manufacturers: (manufacturersResult.data ?? []) as ManufacturerRow[],
      statuses: (statusesResult.data ?? []) as StatusRow[],
      registrations: (registrationsResult.data ?? []) as RegistrationRow[],
      openFaultCountByVehicle,
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
      client.from("prijave_kvarova").select("status_prijave, hitnost"),
      client
        .from("vozila")
        .select("id, model_id, status_id, trenutna_km, zadnji_mali_servis_km"),
      client
        .from("modeli")
        .select("id, naziv, proizvodjac_id, kapacitet_rezervoara, mali_servis_interval_km"),
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

    const faultRows = (faultsResult.data ?? []) as Array<Pick<FaultRow, "status_prijave" | "hitnost">>;
    const activeFaultCount = faultRows.filter((fault) => isFaultOpen(fault.status_prijave)).length;
    const hasCriticalFault = faultRows.some(
      (fault) =>
        isFaultOpen(fault.status_prijave) && normalizeFaultSeverity(fault.hitnost) === "kriticno",
    );

    const latestRegistrationByVehicle = getLatestRegistrations(
      (registrationsResult.data ?? []) as RegistrationRow[],
    );
    const hasExpiringRegistration = Array.from(latestRegistrationByVehicle.values()).some(
      (registration) => {
        const daysUntilExpiry = getDaysUntil(registration.datum_isteka);
        return (
          daysUntilExpiry !== null &&
          daysUntilExpiry >= 0 &&
          daysUntilExpiry <= DAYS_FOR_CRITICAL_REGISTRATION
        );
      },
    );

    const modelById = new Map(
      ((modelsResult.data ?? []) as ModelRow[]).map((model) => [model.id, model]),
    );
    const hasServiceOverdue = ((vehiclesResult.data ?? []) as VehicleRow[]).some((vehicle) => {
      const model = vehicle.model_id ? modelById.get(vehicle.model_id) : null;
      const currentKm = vehicle.trenutna_km ?? 0;
      const lastSmallServiceKm = vehicle.zadnji_mali_servis_km ?? 0;
      const smallServiceIntervalKm = model?.mali_servis_interval_km ?? 15000;

      return smallServiceIntervalKm - (currentKm - lastSmallServiceKm) <= 0;
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
