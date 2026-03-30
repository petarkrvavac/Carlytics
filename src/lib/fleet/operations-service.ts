import { createOptionalServerSupabaseClient } from "@/lib/supabase/server";
import { createOptionalServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type { Tables } from "@/types/database";

type EmployeeRow = Pick<Tables<"zaposlenici">, "id" | "ime" | "prezime" | "korisnicko_ime">;
type ManufacturerRow = Pick<Tables<"proizvodjaci">, "id" | "naziv">;
type ModelRow = Pick<Tables<"modeli">, "id" | "naziv" | "proizvodjac_id">;
type RegistrationRow = Pick<Tables<"registracije">, "vozilo_id" | "registracijska_oznaka" | "datum_isteka">;
type VehicleRow = Pick<Tables<"vozila">, "id" | "model_id" | "trenutna_km">;

const OPEN_FAULT_HINTS = ["novo", "otvor", "cek", "ceka", "obrada", "pending", "active"];
const CLOSED_FAULT_HINTS = ["zatvor", "rijes", "rije", "closed", "resolved", "done"];
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const PRIORITY_RANK = {
  kriticno: 0,
  visoko: 1,
  srednje: 2,
  nisko: 3,
} as const;

type FaultPriority = keyof typeof PRIORITY_RANK;

interface VehicleLookupItem {
  label: string;
  plate: string;
  currentKm: number;
}

export interface ActiveAssignmentOverviewItem {
  id: number;
  startedAtIso: string;
  vehicleId: number | null;
  vehicleLabel: string;
  plate: string;
  employeeName: string;
  employeeUsername: string;
  kmStart: number;
  kmEnd: number | null;
  currentVehicleKm: number;
  kmFromStart: number;
  openFaultCount: number;
}

export interface FuelLedgerItem {
  id: number;
  dateIso: string;
  vehicleId: number | null;
  vehicleLabel: string;
  plate: string;
  employeeName: string;
  kmAtFill: number;
  liters: number;
  pricePerLiter: number;
  totalAmount: number;
}

export interface FaultQueueItem {
  id: number;
  reportedAtIso: string;
  vehicleId: number | null;
  vehicleLabel: string;
  plate: string;
  reporterName: string;
  description: string;
  priority: FaultPriority;
  statusRaw: string | null;
  statusLabel: string;
  isOpen: boolean;
}

export interface ServiceTimelineItem {
  id: number;
  startedAtIso: string;
  endedAtIso: string | null;
  vehicleId: number | null;
  vehicleLabel: string;
  plate: string;
  kmAtMoment: number;
  description: string;
  cost: number;
  isOpen: boolean;
}

export interface OperationsOverviewMetrics {
  activeAssignments: number;
  openFaults: number;
  criticalFaults: number;
  fuelEntries30d: number;
  liters30d: number;
  fuelCost30d: number;
  averageFuelPrice30d: number;
  openServices: number;
}

export interface OperationsOverviewData {
  activeAssignments: ActiveAssignmentOverviewItem[];
  fuelLedger: FuelLedgerItem[];
  faultQueue: FaultQueueItem[];
  serviceTimeline: ServiceTimelineItem[];
  metrics: OperationsOverviewMetrics;
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

function getFallbackData(): OperationsOverviewData {
  return {
    activeAssignments: [],
    fuelLedger: [],
    faultQueue: [],
    serviceTimeline: [],
    metrics: {
      activeAssignments: 0,
      openFaults: 0,
      criticalFaults: 0,
      fuelEntries30d: 0,
      liters30d: 0,
      fuelCost30d: 0,
      averageFuelPrice30d: 0,
      openServices: 0,
    },
    isUsingFallbackData: true,
  };
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
    entries.sort((left, right) => {
      const leftDate = parseDate(left.datum_isteka)?.getTime() ?? 0;
      const rightDate = parseDate(right.datum_isteka)?.getTime() ?? 0;
      return rightDate - leftDate;
    });

    const latest = entries[0];

    if (latest) {
      latestByVehicle.set(vehicleId, latest);
    }
  }

  return latestByVehicle;
}

function buildVehicleLookup(params: {
  vehicles: VehicleRow[];
  models: ModelRow[];
  manufacturers: ManufacturerRow[];
  registrations: RegistrationRow[];
}) {
  const modelById = new Map(params.models.map((model) => [model.id, model]));
  const manufacturerById = new Map(
    params.manufacturers.map((manufacturer) => [manufacturer.id, manufacturer]),
  );
  const latestRegistrationByVehicle = getLatestRegistrations(params.registrations);

  const vehicleMap = new Map<number, VehicleLookupItem>();

  for (const vehicle of params.vehicles) {
    const model = vehicle.model_id ? modelById.get(vehicle.model_id) : null;
    const manufacturer = model?.proizvodjac_id
      ? manufacturerById.get(model.proizvodjac_id)
      : null;

    const manufacturerName = manufacturer?.naziv ?? "Vozilo";
    const modelName = model?.naziv ?? "Bez modela";
    const plate =
      latestRegistrationByVehicle.get(vehicle.id)?.registracijska_oznaka ?? `V-${vehicle.id}`;

    vehicleMap.set(vehicle.id, {
      label: `${manufacturerName} ${modelName}`.trim(),
      plate,
      currentKm: vehicle.trenutna_km ?? 0,
    });
  }

  return vehicleMap;
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

export async function getOperationsOverviewData(): Promise<OperationsOverviewData> {
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
      registrationsResult,
      employeesResult,
      assignmentsResult,
      fuelResult,
      faultsResult,
      servicesResult,
    ] = await Promise.all([
      client.from("vozila").select("id, model_id, trenutna_km"),
      client.from("modeli").select("id, naziv, proizvodjac_id"),
      client.from("proizvodjaci").select("id, naziv"),
      client
        .from("registracije")
        .select("vozilo_id, registracijska_oznaka, datum_isteka"),
      client.from("zaposlenici").select("id, ime, prezime, korisnicko_ime"),
      client
        .from("zaduzenja")
        .select("id, datum_od, vozilo_id, zaposlenik_id, km_pocetna, km_zavrsna, is_aktivno"),
      client
        .from("evidencija_goriva")
        .select("id, datum, km_tocenja, litraza, cijena_po_litri, ukupni_iznos, zaduzenje_id"),
      client
        .from("prijave_kvarova")
        .select("id, datum_prijave, vozilo_id, zaposlenik_id, opis_problema, hitnost, status_prijave"),
      client
        .from("servisne_intervencije")
        .select("id, datum_pocetka, datum_zavrsetka, vozilo_id, km_u_tom_trenutku, opis, cijena"),
    ] as const);

    const queryError = [
      vehiclesResult.error,
      modelsResult.error,
      manufacturersResult.error,
      registrationsResult.error,
      employeesResult.error,
      assignmentsResult.error,
      fuelResult.error,
      faultsResult.error,
      servicesResult.error,
    ].find((error) => Boolean(error));

    if (queryError) {
      throw queryError;
    }

    const vehicles = vehiclesResult.data ?? [];
    const models = modelsResult.data ?? [];
    const manufacturers = manufacturersResult.data ?? [];
    const registrations = registrationsResult.data ?? [];
    const employees = employeesResult.data ?? [];
    const assignments = assignmentsResult.data ?? [];
    const fuelRows = fuelResult.data ?? [];
    const faultRows = faultsResult.data ?? [];
    const serviceRows = servicesResult.data ?? [];

    const vehicleLookup = buildVehicleLookup({
      vehicles,
      models,
      manufacturers,
      registrations,
    });
    const employeeLookup = buildEmployeeLookup(employees);

    const openFaultCountByVehicle = new Map<number, number>();

    for (const fault of faultRows) {
      if (!fault.vozilo_id || !isFaultOpen(fault.status_prijave)) {
        continue;
      }

      const current = openFaultCountByVehicle.get(fault.vozilo_id) ?? 0;
      openFaultCountByVehicle.set(fault.vozilo_id, current + 1);
    }

    const activeAssignments = assignments
      .filter((assignment) => assignment.is_aktivno)
      .map<ActiveAssignmentOverviewItem>((assignment) => {
        const vehicle = assignment.vozilo_id
          ? vehicleLookup.get(assignment.vozilo_id)
          : null;
        const employee = assignment.zaposlenik_id
          ? employeeLookup.get(assignment.zaposlenik_id)
          : null;

        const kmStart = assignment.km_pocetna;
        const kmEnd = assignment.km_zavrsna;
        const currentVehicleKm = vehicle?.currentKm ?? kmEnd ?? kmStart;

        return {
          id: assignment.id,
          startedAtIso: assignment.datum_od,
          vehicleId: assignment.vozilo_id ?? null,
          vehicleLabel: vehicle?.label ?? "Nepoznato vozilo",
          plate: vehicle?.plate ?? "N/A",
          employeeName: employee?.fullName ?? "Nepoznati zaposlenik",
          employeeUsername: employee?.username ?? "n/a",
          kmStart,
          kmEnd,
          currentVehicleKm,
          kmFromStart: Math.max(0, currentVehicleKm - kmStart),
          openFaultCount: assignment.vozilo_id
            ? (openFaultCountByVehicle.get(assignment.vozilo_id) ?? 0)
            : 0,
        };
      })
      .sort((left, right) => compareDatesDesc(left.startedAtIso, right.startedAtIso));

    const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));

    const fuelLedger = fuelRows
      .map<FuelLedgerItem>((entry) => {
        const assignment = entry.zaduzenje_id ? assignmentById.get(entry.zaduzenje_id) : null;
        const vehicle = assignment?.vozilo_id ? vehicleLookup.get(assignment.vozilo_id) : null;
        const employee = assignment?.zaposlenik_id
          ? employeeLookup.get(assignment.zaposlenik_id)
          : null;

        const totalAmount = Number(
          (entry.ukupni_iznos ?? entry.litraza * entry.cijena_po_litri).toFixed(2),
        );

        return {
          id: entry.id,
          dateIso: entry.datum,
          vehicleId: assignment?.vozilo_id ?? null,
          vehicleLabel: vehicle?.label ?? "Nepoznato vozilo",
          plate: vehicle?.plate ?? "N/A",
          employeeName: employee?.fullName ?? "Nepoznati zaposlenik",
          kmAtFill: entry.km_tocenja,
          liters: entry.litraza,
          pricePerLiter: entry.cijena_po_litri,
          totalAmount,
        };
      })
      .sort((left, right) => compareDatesDesc(left.dateIso, right.dateIso));

    const faultQueue = faultRows
      .map<FaultQueueItem>((fault) => {
        const vehicle = fault.vozilo_id ? vehicleLookup.get(fault.vozilo_id) : null;
        const reporter = fault.zaposlenik_id
          ? employeeLookup.get(fault.zaposlenik_id)
          : null;

        const open = isFaultOpen(fault.status_prijave);

        return {
          id: fault.id,
          reportedAtIso: fault.datum_prijave ?? new Date(0).toISOString(),
          vehicleId: fault.vozilo_id ?? null,
          vehicleLabel: vehicle?.label ?? "Nepoznato vozilo",
          plate: vehicle?.plate ?? "N/A",
          reporterName: reporter?.fullName ?? "Nepoznati zaposlenik",
          description: fault.opis_problema,
          priority: normalizeFaultPriority(fault.hitnost),
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

    const serviceTimeline = serviceRows
      .map<ServiceTimelineItem>((service) => {
        const vehicle = service.vozilo_id ? vehicleLookup.get(service.vozilo_id) : null;

        return {
          id: service.id,
          startedAtIso: service.datum_pocetka,
          endedAtIso: service.datum_zavrsetka,
          vehicleId: service.vozilo_id ?? null,
          vehicleLabel: vehicle?.label ?? "Nepoznato vozilo",
          plate: vehicle?.plate ?? "N/A",
          kmAtMoment: service.km_u_tom_trenutku,
          description: service.opis?.trim() || "Bez opisa zahvata",
          cost: service.cijena ?? 0,
          isOpen: !service.datum_zavrsetka,
        };
      })
      .sort((left, right) => compareDatesDesc(left.startedAtIso, right.startedAtIso));

    const now = Date.now();
    const fuelEntriesLast30Days = fuelLedger.filter((entry) => {
      const entryDate = parseDate(entry.dateIso);
      if (!entryDate) {
        return false;
      }

      return now - entryDate.getTime() <= THIRTY_DAYS_MS;
    });

    const liters30d = Number(
      fuelEntriesLast30Days
        .reduce((sum, entry) => sum + entry.liters, 0)
        .toFixed(2),
    );
    const fuelCost30d = Number(
      fuelEntriesLast30Days
        .reduce((sum, entry) => sum + entry.totalAmount, 0)
        .toFixed(2),
    );

    const averageFuelPrice30d =
      fuelEntriesLast30Days.length > 0
        ? Number(
            (
              fuelEntriesLast30Days.reduce(
                (sum, entry) => sum + entry.pricePerLiter,
                0,
              ) / fuelEntriesLast30Days.length
            ).toFixed(2),
          )
        : 0;

    return {
      activeAssignments,
      fuelLedger,
      faultQueue,
      serviceTimeline,
      metrics: {
        activeAssignments: activeAssignments.length,
        openFaults: faultQueue.filter((fault) => fault.isOpen).length,
        criticalFaults: faultQueue.filter(
          (fault) => fault.isOpen && fault.priority === "kriticno",
        ).length,
        fuelEntries30d: fuelEntriesLast30Days.length,
        liters30d,
        fuelCost30d,
        averageFuelPrice30d,
        openServices: serviceTimeline.filter((service) => service.isOpen).length,
      },
      isUsingFallbackData: false,
    };
  } catch (error) {
    console.error("[carlytics] Operativni podaci fallback zbog greške:", error);
    if (!serviceRoleClient) {
      console.error(
        "[carlytics] SUPABASE_SERVICE_ROLE_KEY nije postavljen; anon čitanje može biti ograničeno RLS pravilima.",
      );
    }
    return getFallbackData();
  }
}
