import { createOptionalServerSupabaseClient } from "@/lib/supabase/server";
import { createOptionalServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type { Tables } from "@/types/database";

type AssignmentRow = Pick<
  Tables<"zaduzenja">,
  "id" | "vozilo_id" | "zaposlenik_id" | "datum_od" | "is_aktivno" | "km_pocetna"
>;
type RegistrationRow = Pick<Tables<"registracije">, "vozilo_id" | "registracijska_oznaka" | "datum_isteka">;
type StatusRow = Pick<Tables<"statusi_vozila">, "id" | "naziv">;

export interface FaultCategoryOption {
  id: number;
  naziv: string;
}

export interface ActiveWorkerVehicleContext {
  assignmentId: number;
  vehicleId: number;
  vehicleLabel: string;
  plate: string;
  currentKm: number;
  fuelCapacity: number;
  categoryId?: number | null;
  categoryName?: string;
}

export interface AssignableWorkerVehicleOption {
  vehicleId: number;
  vehicleLabel: string;
  plate: string;
  currentKm: number;
  fuelCapacity: number;
  categoryId: number | null;
  categoryName: string;
}

function getDbClient() {
  return createOptionalServiceRoleSupabaseClient() ?? createOptionalServerSupabaseClient();
}

function normalizeVehicleStatus(label: string | null | undefined) {
  if (!label) {
    return "Na servisu" as const;
  }

  const normalized = label.toLowerCase();

  if (normalized.includes("serv")) {
    return "Na servisu" as const;
  }

  if (normalized.includes("zau") || normalized.includes("vozn") || normalized.includes("duz")) {
    return "Zauzeto" as const;
  }

  return "Slobodno" as const;
}

function getLatestRegistrations(registrations: RegistrationRow[]) {
  const grouped = new Map<number, RegistrationRow[]>();

  for (const registration of registrations) {
    if (!registration.vozilo_id) {
      continue;
    }

    const existing = grouped.get(registration.vozilo_id) ?? [];
    existing.push(registration);
    grouped.set(registration.vozilo_id, existing);
  }

  const latestByVehicle = new Map<number, RegistrationRow>();

  for (const [vehicleId, entries] of grouped) {
    entries.sort((left, right) => {
      const leftDate = new Date(left.datum_isteka).getTime();
      const rightDate = new Date(right.datum_isteka).getTime();

      return rightDate - leftDate;
    });

    const latestEntry = entries[0];

    if (latestEntry) {
      latestByVehicle.set(vehicleId, latestEntry);
    }
  }

  return latestByVehicle;
}

export async function getFaultCategoryOptions(): Promise<FaultCategoryOption[]> {
  const client = getDbClient();

  if (!client) {
    return [
      { id: 1, naziv: "Motor" },
      { id: 2, naziv: "Kočnice" },
      { id: 3, naziv: "Svjetla" },
      { id: 4, naziv: "Ovjes" },
    ];
  }

  const { data, error } = await client
    .from("kategorije_kvarova")
    .select("id, naziv")
    .order("naziv", { ascending: true });

  if (error) {
    console.error("[carlytics] Kategorije kvarova fallback:", error.message);
    return [
      { id: 1, naziv: "Motor" },
      { id: 2, naziv: "Kočnice" },
      { id: 3, naziv: "Svjetla" },
      { id: 4, naziv: "Ovjes" },
    ];
  }

  return data ?? [];
}

async function getLatestRegistrationForVehicle(
  client: NonNullable<ReturnType<typeof getDbClient>>,
  vehicleId: number,
) {
  const { data } = await client
    .from("registracije")
    .select("vozilo_id, registracijska_oznaka, datum_isteka")
    .eq("vozilo_id", vehicleId)
    .order("datum_isteka", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as RegistrationRow | null;
}

async function getAssignmentForEmployee(
  client: NonNullable<ReturnType<typeof getDbClient>>,
  employeeId: number,
) {
  const { data, error } = await client
    .from("zaduzenja")
    .select("id, vozilo_id, zaposlenik_id, datum_od, is_aktivno, km_pocetna")
    .eq("zaposlenik_id", employeeId)
    .eq("is_aktivno", true)
    .order("datum_od", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[carlytics] Aktivno zaduženje fallback:", error.message);
    return null;
  }

  return data as AssignmentRow | null;
}

export async function getActiveWorkerVehicleContext(employeeId: number) {
  const client = getDbClient();

  if (!client) {
    return null;
  }

  const assignment = await getAssignmentForEmployee(client, employeeId);

  if (!assignment?.vozilo_id) {
    return null;
  }

  const [vehicleResult, latestRegistration] = await Promise.all([
    client
      .from("vozila")
      .select(
        "id, trenutna_km, modeli(naziv, kapacitet_rezervoara, kategorija_id, proizvodjaci(naziv), kategorije_vozila(naziv))",
      )
      .eq("id", assignment.vozilo_id)
      .maybeSingle(),
    getLatestRegistrationForVehicle(client, assignment.vozilo_id),
  ] as const);

  const vehicleData = vehicleResult.data as
    | {
        id: number;
        trenutna_km: number | null;
        modeli:
          | {
              naziv: string;
              kapacitet_rezervoara: number | null;
              kategorija_id: number | null;
              proizvodjaci: { naziv: string } | null;
              kategorije_vozila: { naziv: string } | null;
            }
          | null;
      }
    | null;
  const vehicleError = vehicleResult.error;

  if (vehicleError || !vehicleData) {
    console.error("[carlytics] Vozilo za aktivno zaduženje nije dostupno.");
    return null;
  }

  const manufacturerName = vehicleData.modeli?.proizvodjaci?.naziv ?? "Vozilo";
  const modelName = vehicleData.modeli?.naziv ?? "Bez modela";

  return {
    assignmentId: assignment.id,
    vehicleId: vehicleData.id,
    vehicleLabel: `${manufacturerName} ${modelName}`.trim(),
    plate: latestRegistration?.registracijska_oznaka ?? `V-${vehicleData.id}`,
    currentKm: vehicleData.trenutna_km ?? assignment.km_pocetna,
    fuelCapacity: vehicleData.modeli?.kapacitet_rezervoara ?? 0,
    categoryId: vehicleData.modeli?.kategorija_id ?? null,
    categoryName: vehicleData.modeli?.kategorije_vozila?.naziv ?? "Ostalo",
  } satisfies ActiveWorkerVehicleContext;
}

export async function getAvailableWorkerVehicles(
  employeeId: number,
): Promise<AssignableWorkerVehicleOption[]> {
  const client = getDbClient();

  if (!client) {
    return [];
  }

  const activeAssignment = await getAssignmentForEmployee(client, employeeId);

  if (activeAssignment?.is_aktivno) {
    return [];
  }

  const [
    vehiclesResult,
    modelsResult,
    manufacturersResult,
    statusesResult,
    registrationsResult,
    assignmentsResult,
    categoriesResult,
  ] =
    await Promise.all([
      client.from("vozila").select("id, model_id, status_id, trenutna_km"),
      client
        .from("modeli")
        .select("id, naziv, proizvodjac_id, kapacitet_rezervoara, kategorija_id"),
      client.from("proizvodjaci").select("id, naziv"),
      client.from("statusi_vozila").select("id, naziv"),
      client
        .from("registracije")
        .select("vozilo_id, registracijska_oznaka, datum_isteka"),
      client.from("zaduzenja").select("id, vozilo_id, is_aktivno"),
      client.from("kategorije_vozila").select("id, naziv"),
    ] as const);

  const queryError = [
    vehiclesResult.error,
    modelsResult.error,
    manufacturersResult.error,
    statusesResult.error,
    registrationsResult.error,
    assignmentsResult.error,
    categoriesResult.error,
  ].find((error) => Boolean(error));

  if (queryError) {
    console.error("[carlytics] Neuspješan dohvat slobodnih vozila:", queryError.message);
    return [];
  }

  const activeVehicleIds = new Set(
    (assignmentsResult.data ?? [])
      .filter((assignment) => assignment.is_aktivno && Boolean(assignment.vozilo_id))
      .map((assignment) => assignment.vozilo_id as number),
  );

  const modelById = new Map((modelsResult.data ?? []).map((model) => [model.id, model]));
  const manufacturerById = new Map(
    (manufacturersResult.data ?? []).map((manufacturer) => [manufacturer.id, manufacturer]),
  );
  const categoryById = new Map(
    (categoriesResult.data ?? []).map((category) => [category.id, category]),
  );
  const statusById = new Map((statusesResult.data ?? []).map((status: StatusRow) => [status.id, status]));
  const latestRegistrationByVehicle = getLatestRegistrations(registrationsResult.data ?? []);

  const availableVehicles = (vehiclesResult.data ?? []).flatMap<AssignableWorkerVehicleOption>((vehicle) => {
    if (activeVehicleIds.has(vehicle.id)) {
      return [];
    }

    const statusLabel = vehicle.status_id ? statusById.get(vehicle.status_id)?.naziv : null;
    const status = normalizeVehicleStatus(statusLabel);

    if (status === "Na servisu") {
      return [];
    }

    const model = vehicle.model_id ? modelById.get(vehicle.model_id) : null;
    const manufacturer = model?.proizvodjac_id
      ? manufacturerById.get(model.proizvodjac_id)
      : null;
    const category = model?.kategorija_id ? categoryById.get(model.kategorija_id) : null;
    const latestRegistration = latestRegistrationByVehicle.get(vehicle.id);

    return [
      {
        vehicleId: vehicle.id,
        vehicleLabel: `${manufacturer?.naziv ?? "Vozilo"} ${model?.naziv ?? "Bez modela"}`.trim(),
        plate: latestRegistration?.registracijska_oznaka ?? `V-${vehicle.id}`,
        currentKm: vehicle.trenutna_km ?? 0,
        fuelCapacity: model?.kapacitet_rezervoara ?? 0,
        categoryId: model?.kategorija_id ?? null,
        categoryName: category?.naziv ?? "Ostalo",
      },
    ];
  });

  availableVehicles.sort((left, right) => {
    const byLabel = left.vehicleLabel.localeCompare(right.vehicleLabel, "hr-HR");

    if (byLabel !== 0) {
      return byLabel;
    }

    return left.plate.localeCompare(right.plate, "hr-HR");
  });

  return availableVehicles;
}
