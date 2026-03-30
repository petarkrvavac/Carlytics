import { MOCK_DASHBOARD_DATA } from "@/lib/fleet/mock-dashboard-data";
import {
  type ActiveAssignmentOverviewItem,
  type FaultQueueItem,
  type FuelLedgerItem,
  type ServiceTimelineItem,
} from "@/lib/fleet/operations-service";
import { createOptionalServerSupabaseClient } from "@/lib/supabase/server";
import { createOptionalServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type { VehicleListItem, VehicleStatus } from "@/lib/fleet/types";
import type { Tables } from "@/types/database";

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
type RegistrationRow = Pick<
  Tables<"registracije">,
  "vozilo_id" | "registracijska_oznaka" | "datum_isteka"
>;
type FaultRow = Pick<
  Tables<"prijave_kvarova">,
  "id" | "datum_prijave" | "vozilo_id" | "zaposlenik_id" | "opis_problema" | "hitnost" | "status_prijave"
>;
type AssignmentRow = Pick<
  Tables<"zaduzenja">,
  "id" | "datum_od" | "vozilo_id" | "zaposlenik_id" | "km_pocetna" | "km_zavrsna" | "is_aktivno"
>;
type EmployeeRow = Pick<Tables<"zaposlenici">, "id" | "ime" | "prezime" | "korisnicko_ime">;
type FuelRow = Pick<
  Tables<"evidencija_goriva">,
  "id" | "datum" | "km_tocenja" | "litraza" | "cijena_po_litri" | "ukupni_iznos" | "zaduzenje_id"
>;
type ServiceRow = Pick<
  Tables<"servisne_intervencije">,
  "id" | "datum_pocetka" | "datum_zavrsetka" | "vozilo_id" | "km_u_tom_trenutku" | "opis" | "cijena"
>;

const OPEN_FAULT_HINTS = ["novo", "otvor", "cek", "ceka", "obrada", "pending", "active"];
const CLOSED_FAULT_HINTS = ["zatvor", "rijes", "rije", "closed", "resolved", "done"];
const PRIORITY_RANK = {
  kriticno: 0,
  visoko: 1,
  srednje: 2,
  nisko: 3,
} as const;
type FaultPriority = keyof typeof PRIORITY_RANK;

export interface VehicleDigitalTwinData {
  vehicle: VehicleListItem | null;
  activeAssignment: ActiveAssignmentOverviewItem | null;
  faultHistory: FaultQueueItem[];
  fuelHistory: FuelLedgerItem[];
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
    return open ? "Novo" : "Zatvoreno";
  }

  const normalized = status.toLowerCase();

  if (normalized.includes("obr")) {
    return "U obradi";
  }

  if (normalized.includes("zat") || normalized.includes("closed") || normalized.includes("res")) {
    return "Zatvoreno";
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

async function getVehicleSnapshotById(vehicleId: number) {
  const serviceRoleClient = createOptionalServiceRoleSupabaseClient();
  const client = serviceRoleClient ?? createOptionalServerSupabaseClient();

  if (!client) {
    return {
      vehicle: MOCK_DASHBOARD_DATA.vehicles.find((vehicle) => vehicle.id === vehicleId) ?? null,
      isUsingFallbackData: true,
    };
  }

  try {
    const [
      vehicleResult,
      modelsResult,
      manufacturersResult,
      statusesResult,
      registrationsResult,
      faultsResult,
    ] = await Promise.all([
      client
        .from("vozila")
        .select("id, model_id, status_id, trenutna_km, zadnji_mali_servis_km")
        .eq("id", vehicleId)
        .maybeSingle(),
      client
        .from("modeli")
        .select("id, naziv, proizvodjac_id, kapacitet_rezervoara, mali_servis_interval_km"),
      client.from("proizvodjaci").select("id, naziv"),
      client.from("statusi_vozila").select("id, naziv"),
      client
        .from("registracije")
        .select("vozilo_id, registracijska_oznaka, datum_isteka")
        .eq("vozilo_id", vehicleId),
      client
        .from("prijave_kvarova")
        .select("id, datum_prijave, vozilo_id, zaposlenik_id, opis_problema, hitnost, status_prijave")
        .eq("vozilo_id", vehicleId),
    ] as const);

    const queryError = [
      vehicleResult.error,
      modelsResult.error,
      manufacturersResult.error,
      statusesResult.error,
      registrationsResult.error,
      faultsResult.error,
    ].find((error) => Boolean(error));

    if (queryError) {
      throw queryError;
    }

    if (!vehicleResult.data) {
      return {
        vehicle: null,
        isUsingFallbackData: false,
      };
    }

    const vehicleRow = vehicleResult.data as VehicleRow;
    const models = (modelsResult.data ?? []) as ModelRow[];
    const manufacturers = (manufacturersResult.data ?? []) as ManufacturerRow[];
    const statuses = (statusesResult.data ?? []) as StatusRow[];
    const registrations = (registrationsResult.data ?? []) as RegistrationRow[];
    const faultRows = (faultsResult.data ?? []) as FaultRow[];

    const modelById = new Map(models.map((model: ModelRow) => [model.id, model]));
    const manufacturerById = new Map(
      manufacturers.map((manufacturer: ManufacturerRow) => [manufacturer.id, manufacturer]),
    );
    const statusById = new Map(statuses.map((status: StatusRow) => [status.id, status]));

    const model = vehicleRow.model_id ? modelById.get(vehicleRow.model_id) : null;
    const manufacturer = model?.proizvodjac_id
      ? manufacturerById.get(model.proizvodjac_id)
      : null;
    const statusLabel = vehicleRow.status_id ? statusById.get(vehicleRow.status_id)?.naziv : null;

    const latestRegistration = getLatestRegistration(registrations);
    const openFaultCount = faultRows.filter((fault: FaultRow) => isFaultOpen(fault.status_prijave)).length;

    const currentKm = vehicleRow.trenutna_km ?? 0;
    const lastSmallServiceKm = vehicleRow.zadnji_mali_servis_km ?? 0;
    const smallServiceIntervalKm = model?.mali_servis_interval_km ?? 15000;

    return {
      vehicle: {
        id: vehicleRow.id,
        make: manufacturer?.naziv ?? "Nepoznato",
        model: model?.naziv ?? "Nepoznati model",
        plate: latestRegistration?.registracijska_oznaka ?? `V-${vehicleRow.id}`,
        km: currentKm,
        fuelCapacity: model?.kapacitet_rezervoara ?? 0,
        serviceDueKm: smallServiceIntervalKm - (currentKm - lastSmallServiceKm),
        status: normalizeStatus(statusLabel),
        registrationExpiryDays: getDaysUntil(latestRegistration?.datum_isteka),
        openFaultCount,
      } satisfies VehicleListItem,
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
  serviceHistory: ServiceTimelineItem[];
  isUsingFallbackData: boolean;
}> {
  const client = createOptionalServiceRoleSupabaseClient() ?? createOptionalServerSupabaseClient();

  if (!client) {
    return {
      activeAssignment: null,
      faultHistory: [],
      fuelHistory: [],
      serviceHistory: [],
      isUsingFallbackData: true,
    };
  }

  try {
    const [assignmentsResult, employeesResult, faultsResult, servicesResult] = await Promise.all([
      client
        .from("zaduzenja")
        .select("id, datum_od, vozilo_id, zaposlenik_id, km_pocetna, km_zavrsna, is_aktivno")
        .eq("vozilo_id", vehicleId),
      client.from("zaposlenici").select("id, ime, prezime, korisnicko_ime"),
      client
        .from("prijave_kvarova")
        .select("id, datum_prijave, vozilo_id, zaposlenik_id, opis_problema, hitnost, status_prijave")
        .eq("vozilo_id", vehicleId),
      client
        .from("servisne_intervencije")
        .select("id, datum_pocetka, datum_zavrsetka, vozilo_id, km_u_tom_trenutku, opis, cijena")
        .eq("vozilo_id", vehicleId),
    ] as const);

    const queryError = [
      assignmentsResult.error,
      employeesResult.error,
      faultsResult.error,
      servicesResult.error,
    ].find((error) => Boolean(error));

    if (queryError) {
      throw queryError;
    }

    const assignments = (assignmentsResult.data ?? []) as AssignmentRow[];
    const employees = (employeesResult.data ?? []) as EmployeeRow[];
    const faults = (faultsResult.data ?? []) as FaultRow[];
    const services = (servicesResult.data ?? []) as ServiceRow[];

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

    const openFaultCount = faults.filter((fault) => isFaultOpen(fault.status_prijave)).length;
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

    const faultHistory = faults
      .map<FaultQueueItem>((fault) => {
        const open = isFaultOpen(fault.status_prijave);
        const priority = normalizeFaultPriority(fault.hitnost);

        return {
          id: fault.id,
          reportedAtIso: fault.datum_prijave ?? new Date(0).toISOString(),
          vehicleId,
          vehicleLabel: `${vehicle.make} ${vehicle.model}`,
          plate: vehicle.plate,
          reporterName: fault.zaposlenik_id
            ? (employeeLookup.get(fault.zaposlenik_id)?.fullName ?? "Nepoznati zaposlenik")
            : "Nepoznati zaposlenik",
          description: fault.opis_problema,
          priority,
          statusRaw: fault.status_prijave,
          statusLabel: normalizeFaultStatusLabel(fault.status_prijave, open),
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

    const serviceHistory = services
      .map<ServiceTimelineItem>((service) => ({
        id: service.id,
        startedAtIso: service.datum_pocetka,
        endedAtIso: service.datum_zavrsetka,
        vehicleId,
        vehicleLabel: `${vehicle.make} ${vehicle.model}`,
        plate: vehicle.plate,
        kmAtMoment: service.km_u_tom_trenutku,
        description: service.opis?.trim() || "Bez opisa zahvata",
        cost: service.cijena ?? 0,
        isOpen: !service.datum_zavrsetka,
      }))
      .sort((left, right) => compareDatesDesc(left.startedAtIso, right.startedAtIso));

    return {
      activeAssignment,
      faultHistory,
      fuelHistory,
      serviceHistory,
      isUsingFallbackData: false,
    };
  } catch (error) {
    console.error("[carlytics] Digital twin operativni podaci fallback zbog greške:", error);
    return {
      activeAssignment: null,
      faultHistory: [],
      fuelHistory: [],
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
    serviceHistory: history.serviceHistory,
    isUsingFallbackData: snapshotResult.isUsingFallbackData || history.isUsingFallbackData,
  };
}
