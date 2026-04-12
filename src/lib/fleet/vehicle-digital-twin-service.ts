import { MOCK_DASHBOARD_DATA } from "@/lib/fleet/mock-dashboard-data";
import {
  type ActiveAssignmentOverviewItem,
  type FaultQueueItem,
  type FuelLedgerItem,
  type ServiceTimelineItem,
} from "@/lib/fleet/operations-service";
import { evaluateVehicleServiceDue } from "@/lib/fleet/service-due";
import {
  applyInterventionVisibilityFilter,
  isInterventionInProgress,
  isInterventionOpen,
} from "@/lib/fleet/intervention-utils";
import { createOptionalServerSupabaseClient } from "@/lib/supabase/server";
import { createOptionalServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type { VehicleListItem, VehicleStatus } from "@/lib/fleet/types";
import type { Tables } from "@/types/database";

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
type RegistrationRow = Pick<
  Tables<"registracije">,
  "id" | "vozilo_id" | "registracijska_oznaka" | "datum_registracije" | "datum_isteka" | "cijena"
>;
type AssignmentRow = Pick<
  Tables<"zaduzenja">,
  "id" | "datum_od" | "vozilo_id" | "zaposlenik_id" | "km_pocetna" | "km_zavrsna" | "is_aktivno"
>;
type EmployeeRow = Pick<Tables<"zaposlenici">, "id" | "ime" | "prezime" | "korisnicko_ime">;
type TireRow = Pick<
  Tables<"evidencija_guma">,
  "id" | "datum_kupovine" | "sezona" | "proizvodjac" | "cijena" | "vozilo_id"
>;
type FuelRow = Pick<
  Tables<"evidencija_goriva">,
  "id" | "datum" | "km_tocenja" | "litraza" | "cijena_po_litri" | "ukupni_iznos" | "zaduzenje_id"
>;
type InterventionRow = Pick<
  Tables<"servisne_intervencije">,
  "id"
  | "datum_pocetka"
  | "datum_zavrsetka"
  | "attachment_url"
  | "vozilo_id"
  | "zaposlenik_id"
  | "km_u_tom_trenutku"
  | "opis"
  | "hitnost"
  | "status_prijave"
  | "cijena"
  | "kategorija_id"
>;

const SERVICE_FAULT_CATEGORY_ID = 9;
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
const PRIORITY_RANK = {
  kriticno: 0,
  visoko: 1,
  srednje: 2,
  nisko: 3,
} as const;
type FaultPriority = keyof typeof PRIORITY_RANK;

export interface VehicleTireHistoryItem {
  id: number;
  season: string | null;
  manufacturer: string | null;
  purchaseDateIso: string | null;
  cost: number | null;
}

export interface VehicleCostBreakdownPoint {
  monthKey: string;
  monthLabel: string;
  fuelCost: number;
  tireCost: number;
  regularServiceCost: number;
  extraordinaryServiceCost: number;
}

export interface VehicleRegistrationHistoryItem {
  id: number;
  registrationDateIso: string;
  expiryDateIso: string;
  registrationPlate: string;
  cost: number | null;
}

export interface VehicleDigitalTwinData {
  vehicle: VehicleListItem | null;
  activeAssignment: ActiveAssignmentOverviewItem | null;
  faultHistory: FaultQueueItem[];
  fuelHistory: FuelLedgerItem[];
  tireHistory: VehicleTireHistoryItem[];
  registrationHistory: VehicleRegistrationHistoryItem[];
  costBreakdownSeries: VehicleCostBreakdownPoint[];
  serviceHistory: ServiceTimelineItem[];
  isUsingFallbackData: boolean;
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

function toMonthKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

function getMonthBuckets(months: number): VehicleCostBreakdownPoint[] {
  const now = new Date();
  const buckets: VehicleCostBreakdownPoint[] = [];

  for (let index = months - 1; index >= 0; index -= 1) {
    const bucketDate = new Date(now.getFullYear(), now.getMonth() - index, 1);

    buckets.push({
      monthKey: toMonthKey(bucketDate),
      monthLabel: HR_MONTH_LABELS[bucketDate.getMonth()],
      fuelCost: 0,
      tireCost: 0,
      regularServiceCost: 0,
      extraordinaryServiceCost: 0,
    });
  }

  return buckets;
}

function buildCostBreakdownSeries(
  fuelRows: FuelRow[],
  tireRows: TireRow[],
  serviceRows: InterventionRow[],
) {
  const buckets = getMonthBuckets(MONTH_BUCKET_COUNT);
  const bucketByKey = new Map(buckets.map((bucket) => [bucket.monthKey, bucket]));

  for (const fuel of fuelRows) {
    const date = parseDate(fuel.datum);

    if (!date) {
      continue;
    }

    const bucket = bucketByKey.get(toMonthKey(date));

    if (!bucket) {
      continue;
    }

    const total = fuel.ukupni_iznos ?? fuel.litraza * fuel.cijena_po_litri;
    bucket.fuelCost += total;
  }

  for (const tire of tireRows) {
    const date = parseDate(tire.datum_kupovine);

    if (!date || !tire.cijena) {
      continue;
    }

    const bucket = bucketByKey.get(toMonthKey(date));

    if (!bucket) {
      continue;
    }

    bucket.tireCost += tire.cijena;
  }

  for (const service of serviceRows) {
    const date = parseDate(service.datum_zavrsetka ?? service.datum_pocetka);

    if (!date) {
      continue;
    }

    const bucket = bucketByKey.get(toMonthKey(date));

    if (!bucket) {
      continue;
    }

    const cost = service.cijena ?? 0;

    if (service.kategorija_id === SERVICE_FAULT_CATEGORY_ID) {
      bucket.regularServiceCost += cost;
    } else {
      bucket.extraordinaryServiceCost += cost;
    }
  }

  return buckets.map((bucket) => ({
    ...bucket,
    fuelCost: Number(bucket.fuelCost.toFixed(2)),
    tireCost: Number(bucket.tireCost.toFixed(2)),
    regularServiceCost: Number(bucket.regularServiceCost.toFixed(2)),
    extraordinaryServiceCost: Number(bucket.extraordinaryServiceCost.toFixed(2)),
  }));
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

function normalizeFaultPriority(hitnost: string | null): FaultPriority {
  if (!hitnost) {
    return "srednje";
  }

  const normalized = hitnost.toLowerCase();

  if (normalized.includes("krit") || normalized.includes("critical")) {
    return "kriticno";
  }

  if (normalized.includes("vis") || normalized.includes("high") || normalized.includes("hitno")) {
    return "visoko";
  }

  if (normalized.includes("nisk") || normalized.includes("low")) {
    return "nisko";
  }

  return "srednje";
}

function normalizeFaultStatusLabel(status: string | null, open: boolean) {
  if (!status) {
    return open ? "Novo" : "Riješeno";
  }

  const normalized = status.toLowerCase();

  if (normalized.includes("obr")) {
    return "U obradi";
  }

  if (
    normalized.includes("zat") ||
    normalized.includes("rije") ||
    normalized.includes("rijes") ||
    normalized.includes("closed") ||
    normalized.includes("res")
  ) {
    return "Riješeno";
  }

  if (normalized.includes("novo") || normalized.includes("otvor")) {
    return "Novo";
  }

  return status;
}

function compareDatesDesc(leftIso: string | null | undefined, rightIso: string | null | undefined) {
  const leftTime = parseDate(leftIso)?.getTime() ?? 0;
  const rightTime = parseDate(rightIso)?.getTime() ?? 0;
  return rightTime - leftTime;
}

function buildEmployeeLookup(employees: EmployeeRow[]) {
  const employeeMap = new Map<
    number,
    {
      fullName: string;
      username: string;
    }
  >();

  for (const employee of employees) {
    employeeMap.set(employee.id, {
      fullName: `${employee.ime} ${employee.prezime}`.trim(),
      username: employee.korisnicko_ime,
    });
  }

  return employeeMap;
}

function getLatestRegistration(registrations: RegistrationRow[]) {
  const sorted = [...registrations].sort((left, right) => {
    const leftDate = parseDate(left.datum_isteka)?.getTime() ?? 0;
    const rightDate = parseDate(right.datum_isteka)?.getTime() ?? 0;
    return rightDate - leftDate;
  });

  return sorted[0] ?? null;
}

function buildRegistrationHistory(registrations: RegistrationRow[]): VehicleRegistrationHistoryItem[] {
  return [...registrations]
    .sort((left, right) => {
      const leftRegistrationDate = parseDate(left.datum_registracije)?.getTime() ?? 0;
      const rightRegistrationDate = parseDate(right.datum_registracije)?.getTime() ?? 0;

      if (leftRegistrationDate !== rightRegistrationDate) {
        return rightRegistrationDate - leftRegistrationDate;
      }

      const leftExpiryDate = parseDate(left.datum_isteka)?.getTime() ?? 0;
      const rightExpiryDate = parseDate(right.datum_isteka)?.getTime() ?? 0;
      return rightExpiryDate - leftExpiryDate;
    })
    .map((registration) => ({
      id: registration.id,
      registrationDateIso: registration.datum_registracije,
      expiryDateIso: registration.datum_isteka,
      registrationPlate: registration.registracijska_oznaka,
      cost: registration.cijena,
    }));
}

async function getVehicleSnapshotById(vehicleId: number) {
  const serviceRoleClient = createOptionalServiceRoleSupabaseClient();
  const client = serviceRoleClient ?? createOptionalServerSupabaseClient();

  if (!client) {
    return {
      vehicle: MOCK_DASHBOARD_DATA.vehicles.find((vehicle) => vehicle.id === vehicleId) ?? null,
      registrationHistory: [],
      isUsingFallbackData: true,
    };
  }

  try {
    const [
      vehicleResult,
      modelsResult,
      manufacturersResult,
      fuelTypesResult,
      statusesResult,
      placesResult,
      registrationsResult,
      assignmentsResult,
      interventionsResult,
    ] = await Promise.all([
      client
        .from("vozila")
        .select(
          "id, broj_sasije, model_id, status_id, trenutna_km, datum_kupovine, godina_proizvodnje, is_aktivan, mjesto_id, nabavna_vrijednost, razlog_deaktivacije, zadnji_mali_servis_datum, zadnji_mali_servis_km, zadnji_veliki_servis_datum, zadnji_veliki_servis_km",
        )
        .eq("id", vehicleId)
        .maybeSingle(),
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
        .select("id, vozilo_id, registracijska_oznaka, datum_registracije, datum_isteka, cijena")
        .eq("vozilo_id", vehicleId),
      client
        .from("zaduzenja")
        .select("vozilo_id, is_aktivno")
        .eq("vozilo_id", vehicleId),
      applyInterventionVisibilityFilter(
        client
          .from("servisne_intervencije")
          .select(
            "id, datum_pocetka, datum_zavrsetka, attachment_url, vozilo_id, zaposlenik_id, km_u_tom_trenutku, opis, hitnost, status_prijave, kategorija_id, cijena",
          )
          .eq("vozilo_id", vehicleId),
      ),
    ] as const);

    const queryError = [
      vehicleResult.error,
      modelsResult.error,
      manufacturersResult.error,
      fuelTypesResult.error,
      statusesResult.error,
      placesResult.error,
      registrationsResult.error,
      assignmentsResult.error,
      interventionsResult.error,
    ].find((error) => Boolean(error));

    if (queryError) {
      throw queryError;
    }

    if (!vehicleResult.data) {
      return {
        vehicle: null,
        registrationHistory: [],
        isUsingFallbackData: false,
      };
    }

    const vehicleRow = vehicleResult.data as VehicleRow;
    const models = (modelsResult.data ?? []) as ModelRow[];
    const manufacturers = (manufacturersResult.data ?? []) as ManufacturerRow[];
    const fuelTypes = (fuelTypesResult.data ?? []) as FuelTypeRow[];
    const statuses = (statusesResult.data ?? []) as StatusRow[];
    const places = (placesResult.data ?? []) as PlaceRow[];
    const registrations = (registrationsResult.data ?? []) as RegistrationRow[];
    const assignments = (assignmentsResult.data ?? []) as AssignmentRow[];
    const interventionRows = (interventionsResult.data ?? []) as InterventionRow[];

    const modelById = new Map(models.map((model: ModelRow) => [model.id, model]));
    const manufacturerById = new Map(
      manufacturers.map((manufacturer: ManufacturerRow) => [manufacturer.id, manufacturer]),
    );
    const fuelTypeById = new Map(fuelTypes.map((fuelType: FuelTypeRow) => [fuelType.id, fuelType]));
    const statusById = new Map(statuses.map((status: StatusRow) => [status.id, status]));
    const cityById = mapLocationByCity(places);

    const model = vehicleRow.model_id ? modelById.get(vehicleRow.model_id) : null;
    const manufacturer = model?.proizvodjac_id
      ? manufacturerById.get(model.proizvodjac_id)
      : null;
    const statusLabel = vehicleRow.status_id ? statusById.get(vehicleRow.status_id)?.naziv : null;

    const latestRegistration = getLatestRegistration(registrations);
    const registrationHistory = buildRegistrationHistory(registrations);
    const openFaultCount = interventionRows.filter((row) => isInterventionOpen(row.status_prijave, row.datum_zavrsetka)).length;
    const hasInProgressIntervention = interventionRows.some(
      (row) =>
        isInterventionOpen(row.status_prijave, row.datum_zavrsetka) &&
        isInterventionInProgress(row.status_prijave),
    );
    const hasActiveAssignment = assignments.some((assignment) => assignment.is_aktivno);
    const isActive = vehicleRow.is_aktivan !== false;
    const cityLabel = vehicleRow.mjesto_id ? (cityById.get(vehicleRow.mjesto_id) ?? null) : null;

    const currentKm = vehicleRow.trenutna_km ?? 0;
    const serviceDue = evaluateVehicleServiceDue({
      currentKm,
      lastSmallServiceKm: vehicleRow.zadnji_mali_servis_km,
      lastLargeServiceKm: vehicleRow.zadnji_veliki_servis_km,
      smallServiceIntervalKm: model?.mali_servis_interval_km,
      largeServiceIntervalKm: model?.veliki_servis_interval_km,
      lastSmallServiceDate: vehicleRow.zadnji_mali_servis_datum ?? vehicleRow.datum_kupovine,
      lastLargeServiceDate: vehicleRow.zadnji_veliki_servis_datum ?? vehicleRow.datum_kupovine,
    });

    return {
      vehicle: {
        id: vehicleRow.id,
        make: manufacturer?.naziv ?? "Nepoznato",
        model: model?.naziv ?? "Nepoznati model",
        plate: latestRegistration?.registracijska_oznaka ?? `V-${vehicleRow.id}`,
        km: currentKm,
        fuelCapacity: model?.kapacitet_rezervoara ?? 0,
        fuelTypeLabel: model?.tip_goriva_id
          ? (fuelTypeById.get(model.tip_goriva_id)?.naziv ?? null)
          : null,
        smallServiceDueKm: serviceDue.smallServiceDueKm,
        largeServiceDueKm: serviceDue.largeServiceDueKm,
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
        registrationExpiryDays: getDaysUntil(latestRegistration?.datum_isteka),
        registrationExpiryDateIso: latestRegistration?.datum_isteka ?? null,
        openFaultCount,
        isActive,
        deactivationReason: vehicleRow.razlog_deaktivacije ?? null,
        vin: vehicleRow.broj_sasije,
        acquisitionValue: vehicleRow.nabavna_vrijednost,
        productionYear: vehicleRow.godina_proizvodnje,
        registrationCity: cityLabel,
        locationCity: cityLabel,
        lastSmallServiceDate: vehicleRow.zadnji_mali_servis_datum,
        lastSmallServiceKm: vehicleRow.zadnji_mali_servis_km,
        lastLargeServiceDate: vehicleRow.zadnji_veliki_servis_datum,
        lastLargeServiceKm: vehicleRow.zadnji_veliki_servis_km,
      } satisfies VehicleListItem,
      registrationHistory,
      isUsingFallbackData: false,
    };
  } catch (error) {
    console.error("[carlytics] Digital twin vozila fallback zbog greške:", error);
    if (!serviceRoleClient) {
      console.error(
        "[carlytics] SUPABASE_SERVICE_ROLE_KEY nije postavljen; anon čitanje može biti ograničeno RLS pravilima.",
      );
    }

    return {
      vehicle: MOCK_DASHBOARD_DATA.vehicles.find((vehicle) => vehicle.id === vehicleId) ?? null,
      registrationHistory: [],
      isUsingFallbackData: true,
    };
  }
}

async function getVehicleOperationalHistory(
  vehicleId: number,
  vehicle: VehicleListItem,
): Promise<{
  activeAssignment: ActiveAssignmentOverviewItem | null;
  faultHistory: FaultQueueItem[];
  fuelHistory: FuelLedgerItem[];
  tireHistory: VehicleTireHistoryItem[];
  costBreakdownSeries: VehicleCostBreakdownPoint[];
  serviceHistory: ServiceTimelineItem[];
  isUsingFallbackData: boolean;
}> {
  const client = createOptionalServiceRoleSupabaseClient() ?? createOptionalServerSupabaseClient();

  if (!client) {
    return {
      activeAssignment: null,
      faultHistory: [],
      fuelHistory: [],
      tireHistory: [],
      costBreakdownSeries: [],
      serviceHistory: [],
      isUsingFallbackData: true,
    };
  }

  try {
    const [assignmentsResult, employeesResult, interventionsResult, tiresResult] = await Promise.all([
      client
        .from("zaduzenja")
        .select("id, datum_od, vozilo_id, zaposlenik_id, km_pocetna, km_zavrsna, is_aktivno")
        .eq("vozilo_id", vehicleId),
      client.from("zaposlenici").select("id, ime, prezime, korisnicko_ime"),
      applyInterventionVisibilityFilter(
        client
          .from("servisne_intervencije")
          .select(
            "id, datum_pocetka, datum_zavrsetka, attachment_url, vozilo_id, zaposlenik_id, km_u_tom_trenutku, opis, hitnost, status_prijave, cijena, kategorija_id",
          )
          .eq("vozilo_id", vehicleId),
      ),
      client
        .from("evidencija_guma")
        .select("id, datum_kupovine, sezona, proizvodjac, cijena, vozilo_id")
        .eq("vozilo_id", vehicleId),
    ] as const);

    const queryError = [
      assignmentsResult.error,
      employeesResult.error,
      interventionsResult.error,
      tiresResult.error,
    ].find((error) => Boolean(error));

    if (queryError) {
      throw queryError;
    }

    const assignments = (assignmentsResult.data ?? []) as AssignmentRow[];
    const employees = (employeesResult.data ?? []) as EmployeeRow[];
    const interventions = (interventionsResult.data ?? []) as InterventionRow[];
    const tires = (tiresResult.data ?? []) as TireRow[];

    const assignmentIds = assignments.map((assignment) => assignment.id);
    let fuelRows: FuelRow[] = [];

    if (assignmentIds.length > 0) {
      const { data: fuelData, error: fuelError } = await client
        .from("evidencija_goriva")
        .select("id, datum, km_tocenja, litraza, cijena_po_litri, ukupni_iznos, zaduzenje_id")
        .in("zaduzenje_id", assignmentIds);

      if (fuelError) {
        throw fuelError;
      }

      fuelRows = (fuelData ?? []) as FuelRow[];
    }

    const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
    const employeeLookup = buildEmployeeLookup(employees);

    const openFaultCount = interventions.filter((row) => isInterventionOpen(row.status_prijave, row.datum_zavrsetka)).length;
    const activeAssignmentRow = [...assignments]
      .filter((assignment) => assignment.is_aktivno)
      .sort((left, right) => compareDatesDesc(left.datum_od, right.datum_od))[0];

    const activeAssignment = activeAssignmentRow
      ? {
          id: activeAssignmentRow.id,
          startedAtIso: activeAssignmentRow.datum_od,
          vehicleId,
          vehicleLabel: `${vehicle.make} ${vehicle.model}`,
          plate: vehicle.plate,
          employeeName: activeAssignmentRow.zaposlenik_id
            ? (employeeLookup.get(activeAssignmentRow.zaposlenik_id)?.fullName ??
              "Nepoznati zaposlenik")
            : "Nepoznati zaposlenik",
          employeeUsername: activeAssignmentRow.zaposlenik_id
            ? (employeeLookup.get(activeAssignmentRow.zaposlenik_id)?.username ?? "n/a")
            : "n/a",
          kmStart: activeAssignmentRow.km_pocetna,
          kmEnd: activeAssignmentRow.km_zavrsna,
          currentVehicleKm: vehicle.km,
          kmFromStart: Math.max(0, vehicle.km - activeAssignmentRow.km_pocetna),
          openFaultCount,
        }
      : null;

    const faultHistory = interventions
      .map<FaultQueueItem>((intervention) => {
        const open = isInterventionOpen(intervention.status_prijave, intervention.datum_zavrsetka);
        const priority = normalizeFaultPriority(intervention.hitnost);

        return {
          id: intervention.id,
          reportedAtIso: intervention.datum_pocetka,
          attachmentUrl: intervention.attachment_url,
          vehicleId,
          vehicleLabel: `${vehicle.make} ${vehicle.model}`,
          plate: vehicle.plate,
          reporterName: intervention.zaposlenik_id
            ? (employeeLookup.get(intervention.zaposlenik_id)?.fullName ?? "Nepoznati zaposlenik")
            : "Nepoznati zaposlenik",
          description: intervention.opis?.trim() || "Bez opisa",
          categoryId: intervention.kategorija_id,
          categoryLabel:
            intervention.kategorija_id === SERVICE_FAULT_CATEGORY_ID
              ? "Redovni servis"
              : "Izvanredni servis",
          priority,
          statusRaw: intervention.status_prijave,
          statusLabel: normalizeFaultStatusLabel(intervention.status_prijave, open),
          isOpen: open,
        };
      })
      .sort((left, right) => {
        if (left.isOpen !== right.isOpen) {
          return left.isOpen ? -1 : 1;
        }

        const priorityDiff = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];

        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        return compareDatesDesc(left.reportedAtIso, right.reportedAtIso);
      });

    const fuelHistory = fuelRows
      .map<FuelLedgerItem>((entry) => {
        const assignment = entry.zaduzenje_id
          ? assignmentById.get(entry.zaduzenje_id)
          : null;

        const totalAmount = Number(
          (entry.ukupni_iznos ?? entry.litraza * entry.cijena_po_litri).toFixed(2),
        );

        return {
          id: entry.id,
          dateIso: entry.datum,
          vehicleId,
          vehicleLabel: `${vehicle.make} ${vehicle.model}`,
          plate: vehicle.plate,
          fuelTypeLabel: vehicle.fuelTypeLabel,
          employeeName: assignment?.zaposlenik_id
            ? (employeeLookup.get(assignment.zaposlenik_id)?.fullName ?? "Nepoznati zaposlenik")
            : "Nepoznati zaposlenik",
          kmAtFill: entry.km_tocenja,
          liters: entry.litraza,
          pricePerLiter: entry.cijena_po_litri,
          totalAmount,
        };
      })
      .sort((left, right) => compareDatesDesc(left.dateIso, right.dateIso));

    const serviceHistory = interventions
      .map<ServiceTimelineItem>((service) => ({
        id: service.id,
        startedAtIso: service.datum_pocetka,
        endedAtIso: service.datum_zavrsetka,
        attachmentUrl: service.attachment_url,
        vehicleId,
        vehicleLabel: `${vehicle.make} ${vehicle.model}`,
        plate: vehicle.plate,
        kmAtMoment: service.km_u_tom_trenutku,
        description: service.opis?.trim() || "Bez opisa zahvata",
        cost: service.cijena ?? 0,
        isOpen: !service.datum_zavrsetka,
        categoryId: service.kategorija_id,
        categoryLabel:
          service.kategorija_id === SERVICE_FAULT_CATEGORY_ID
            ? "Redovni servis"
            : "Izvanredni servis",
      }))
      .sort((left, right) => compareDatesDesc(left.startedAtIso, right.startedAtIso));

    const tireHistory = [...tires]
      .sort((left, right) => compareDatesDesc(left.datum_kupovine, right.datum_kupovine))
      .map<VehicleTireHistoryItem>((entry) => ({
        id: entry.id,
        season: entry.sezona,
        manufacturer: entry.proizvodjac,
        purchaseDateIso: entry.datum_kupovine,
        cost: entry.cijena,
      }));

    const costBreakdownSeries = buildCostBreakdownSeries(fuelRows, tires, interventions);

    return {
      activeAssignment,
      faultHistory,
      fuelHistory,
      tireHistory,
      costBreakdownSeries,
      serviceHistory,
      isUsingFallbackData: false,
    };
  } catch (error) {
    console.error("[carlytics] Digital twin operativni podaci fallback zbog greške:", error);
    return {
      activeAssignment: null,
      faultHistory: [],
      fuelHistory: [],
      tireHistory: [],
      costBreakdownSeries: [],
      serviceHistory: [],
      isUsingFallbackData: true,
    };
  }
}

export async function getVehicleDigitalTwinData(
  vehicleId: number,
): Promise<VehicleDigitalTwinData> {
  const snapshotResult = await getVehicleSnapshotById(vehicleId);

  if (!snapshotResult.vehicle) {
    return {
      vehicle: null,
      activeAssignment: null,
      faultHistory: [],
      fuelHistory: [],
      tireHistory: [],
      registrationHistory: snapshotResult.registrationHistory,
      costBreakdownSeries: [],
      serviceHistory: [],
      isUsingFallbackData: snapshotResult.isUsingFallbackData,
    };
  }

  const history = await getVehicleOperationalHistory(vehicleId, snapshotResult.vehicle);

  return {
    vehicle: snapshotResult.vehicle,
    activeAssignment: history.activeAssignment,
    faultHistory: history.faultHistory,
    fuelHistory: history.fuelHistory,
    tireHistory: history.tireHistory,
    registrationHistory: snapshotResult.registrationHistory,
    costBreakdownSeries: history.costBreakdownSeries,
    serviceHistory: history.serviceHistory,
    isUsingFallbackData: snapshotResult.isUsingFallbackData || history.isUsingFallbackData,
  };
}
