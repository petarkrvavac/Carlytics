"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/lib/actions/action-state";
import { requireSessionUser } from "@/lib/auth/session";
import { evaluateVehicleServiceDue } from "@/lib/fleet/service-due";
import { getActiveWorkerVehicleContext } from "@/lib/fleet/worker-context-service";
import { createOptionalServerSupabaseClient } from "@/lib/supabase/server";
import { createOptionalServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import { formatDateTime, getCurrentIsoTimestamp } from "@/lib/utils/date-format";
import type { Tables } from "@/types/database";

type VehicleStatusRow = Tables<"statusi_vozila">;

const assignVehicleSchema = z.object({
  vehicleId: z.coerce.number().int().positive("Odaberi vozilo koje zadužuješ."),
});

const releaseVehicleKilometersSchema = z.object({
  kmZavrsna: z.coerce
    .number()
    .int("Kilometraža mora biti cijeli broj.")
    .positive("Kilometraža mora biti veća od 0."),
});

const releaseVehicleSchema = releaseVehicleKilometersSchema;

const releaseManagedAssignmentSchema = releaseVehicleKilometersSchema.extend({
  assignmentId: z.coerce.number().int().positive("Zaduženje je obavezno."),
});

function getDbClient() {
  return createOptionalServiceRoleSupabaseClient() ?? createOptionalServerSupabaseClient();
}

function normalizeStatusName(statusName: string | null | undefined) {
  if (!statusName) {
    return "";
  }

  return statusName.trim().toLowerCase();
}

async function resolveVehicleStatusId(
  client: NonNullable<ReturnType<typeof getDbClient>>,
  statusType: "slobodno" | "zauzeto" | "servis",
) {
  const { data, error } = await client.from("statusi_vozila").select("id, naziv");

  if (error) {
    console.error("[carlytics] Neuspješan dohvat statusa vozila:", error.message);
    return null;
  }

  const statusRows = data ?? [];

  const match = statusRows.find((status: VehicleStatusRow) => {
    const normalized = normalizeStatusName(status.naziv);

    if (statusType === "slobodno") {
      return normalized.includes("slob");
    }

    if (statusType === "servis") {
      return normalized.includes("serv");
    }

    return normalized.includes("zau") || normalized.includes("vozn") || normalized.includes("duz");
  });

  return match?.id ?? null;
}

function revalidateAssignmentPaths() {
  revalidatePath("/m");
  revalidatePath("/m/gorivo");
  revalidatePath("/m/prijava-kvara");
  revalidatePath("/dashboard");
  revalidatePath("/zaduzenja");
  revalidatePath("/flota");
  revalidatePath("/prijava-kvara");
  revalidatePath("/povijest-servisa");
}

async function finalizeVehicleRelease(params: {
  client: NonNullable<ReturnType<typeof getDbClient>>;
  assignmentId: number;
  assignmentEmployeeId: number | null;
  vehicleId: number;
  kmZavrsna: number;
  enforceEmployeeId?: number;
}): Promise<ActionState> {
  const finishedAtIso = getCurrentIsoTimestamp();

  let releaseQuery = params.client
    .from("zaduzenja")
    .update({
      is_aktivno: false,
      datum_do: finishedAtIso,
      km_zavrsna: params.kmZavrsna,
    })
    .eq("id", params.assignmentId)
    .eq("is_aktivno", true);

  if (typeof params.enforceEmployeeId === "number") {
    releaseQuery = releaseQuery.eq("zaposlenik_id", params.enforceEmployeeId);
  }

  const { error: releaseError } = await releaseQuery;

  if (releaseError) {
    console.error("[carlytics] Neuspješno razduženje vozila:", releaseError.message);
    return {
      status: "error",
      message: "Razduženje nije uspjelo. Pokušaj ponovno.",
    };
  }

  const { data: vehicleRow, error: vehicleFetchError } = await params.client
    .from("vozila")
    .select(
      "id, model_id, datum_kupovine, zadnji_mali_servis_datum, zadnji_mali_servis_km, zadnji_veliki_servis_datum, zadnji_veliki_servis_km",
    )
    .eq("id", params.vehicleId)
    .maybeSingle();

  if (vehicleFetchError || !vehicleRow) {
    console.error(
      "[carlytics] Razduženje uspjelo, ali dohvat vozila nije uspio:",
      vehicleFetchError?.message,
    );
    return {
      status: "error",
      message: "Razduženje je spremljeno, ali stanje vozila nije moguće dohvatiti.",
    };
  }

  let smallServiceIntervalKm: number | null = null;
  let largeServiceIntervalKm: number | null = null;

  if (vehicleRow.model_id) {
    const { data: modelRow, error: modelError } = await params.client
      .from("modeli")
      .select("mali_servis_interval_km, veliki_servis_interval_km")
      .eq("id", vehicleRow.model_id)
      .maybeSingle();

    if (modelError) {
      console.error("[carlytics] Razduženje: dohvat modela nije uspio:", modelError.message);
    } else if (modelRow) {
      smallServiceIntervalKm = modelRow.mali_servis_interval_km;
      largeServiceIntervalKm = modelRow.veliki_servis_interval_km;
    }
  }

  const serviceDue = evaluateVehicleServiceDue({
    currentKm: params.kmZavrsna,
    lastSmallServiceKm: vehicleRow.zadnji_mali_servis_km,
    lastLargeServiceKm: vehicleRow.zadnji_veliki_servis_km,
    smallServiceIntervalKm,
    largeServiceIntervalKm,
    lastSmallServiceDate: vehicleRow.zadnji_mali_servis_datum ?? vehicleRow.datum_kupovine,
    lastLargeServiceDate: vehicleRow.zadnji_veliki_servis_datum ?? vehicleRow.datum_kupovine,
  });

  const targetStatus: "slobodno" | "servis" = serviceDue.isServiceDue ? "servis" : "slobodno";

  const nextStatusId = await resolveVehicleStatusId(params.client, targetStatus);
  const vehicleUpdatePayload: {
    trenutna_km: number;
    status_id?: number;
  } = {
    trenutna_km: params.kmZavrsna,
  };

  if (nextStatusId) {
    vehicleUpdatePayload.status_id = nextStatusId;
  }

  const { error: vehicleStatusError } = await params.client
    .from("vozila")
    .update(vehicleUpdatePayload)
    .eq("id", params.vehicleId);

  if (vehicleStatusError) {
    console.error(
      "[carlytics] Razduženje uspjelo, ali status/km vozila nisu ažurirani:",
      vehicleStatusError.message,
    );
    return {
      status: "error",
      message: "Razduženje je spremljeno, ali stanje vozila nije potpuno ažurirano.",
    };
  }

  return {
    status: "success",
    message:
      targetStatus === "servis"
        ? `Vozilo je razduženo i prebačeno u servisnu zonu (${serviceDue.serviceDueLabel}).`
        : `Vozilo je razduženo. Datum razduženja je spremljen (${formatDateTime(finishedAtIso)}).`,
  };
}

export async function releaseWorkerVehicleAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  void _previousState;

  const parsed = releaseVehicleSchema.safeParse({
    kmZavrsna: formData.get("kmZavrsna"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Unesi valjanu završnu kilometražu.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const sessionUser = await requireSessionUser({
    allowedRoles: ["zaposlenik", "admin"],
    redirectTo: "/prijava",
    forbiddenRedirectTo: "/dashboard",
  });

  const client = getDbClient();

  if (!client) {
    return {
      status: "error",
      message: "Supabase nije konfiguriran. Razduženje nije spremljeno.",
    };
  }

  const activeContext = await getActiveWorkerVehicleContext(sessionUser.employeeId);

  if (!activeContext) {
    return {
      status: "error",
      message: "Nemate aktivno zaduženje vozila.",
    };
  }

  if (parsed.data.kmZavrsna < activeContext.currentKm) {
    return {
      status: "error",
      message: `Završna kilometraža mora biti >= ${activeContext.currentKm.toLocaleString("hr-HR")} km.`,
      fieldErrors: {
        kmZavrsna: ["Kilometraža ne može biti manja od trenutačne."],
      },
    };
  }

  const releaseResult = await finalizeVehicleRelease({
    client,
    assignmentId: activeContext.assignmentId,
    assignmentEmployeeId: sessionUser.employeeId,
    vehicleId: activeContext.vehicleId,
    kmZavrsna: parsed.data.kmZavrsna,
    enforceEmployeeId: sessionUser.employeeId,
  });

  if (releaseResult.status !== "success") {
    return releaseResult;
  }

  revalidateAssignmentPaths();
  return {
    ...releaseResult,
    payload: {
      assignmentId: activeContext.assignmentId,
      vehicleId: activeContext.vehicleId,
      kmZavrsna: parsed.data.kmZavrsna,
    },
  };
}

export async function releaseDesktopAssignmentAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  void _previousState;

  const parsed = releaseManagedAssignmentSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    kmZavrsna: formData.get("kmZavrsna"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Unesi valjane podatke za razduženje.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await requireSessionUser({
    allowedRoles: ["admin", "voditelj_flote"],
    redirectTo: "/prijava",
    forbiddenRedirectTo: "/m",
  });

  const client = getDbClient();

  if (!client) {
    return {
      status: "error",
      message: "Supabase nije konfiguriran. Razduženje nije spremljeno.",
    };
  }

  const { data: assignmentRow, error: assignmentError } = await client
    .from("zaduzenja")
    .select("id, vozilo_id, zaposlenik_id, is_aktivno")
    .eq("id", parsed.data.assignmentId)
    .maybeSingle();

  if (assignmentError || !assignmentRow?.vozilo_id) {
    console.error(
      "[carlytics] Neuspješan dohvat zaduženja za desktop razduženje:",
      assignmentError?.message,
    );
    return {
      status: "error",
      message: "Odabrano zaduženje nije dostupno.",
    };
  }

  if (!assignmentRow.is_aktivno) {
    return {
      status: "error",
      message: "Odabrano zaduženje je već zatvoreno.",
    };
  }

  const { data: vehicleRow, error: vehicleError } = await client
    .from("vozila")
    .select("trenutna_km")
    .eq("id", assignmentRow.vozilo_id)
    .maybeSingle();

  if (vehicleError) {
    console.error(
      "[carlytics] Neuspješan dohvat kilometraže vozila za desktop razduženje:",
      vehicleError.message,
    );
    return {
      status: "error",
      message: "Neuspješan dohvat trenutačne kilometraže vozila.",
    };
  }

  const currentKm = vehicleRow?.trenutna_km ?? 0;

  if (parsed.data.kmZavrsna < currentKm) {
    return {
      status: "error",
      message: `Završna kilometraža mora biti >= ${currentKm.toLocaleString("hr-HR")} km.`,
      fieldErrors: {
        kmZavrsna: ["Kilometraža ne može biti manja od trenutačne."],
      },
    };
  }

  const releaseResult = await finalizeVehicleRelease({
    client,
    assignmentId: assignmentRow.id,
    assignmentEmployeeId: assignmentRow.zaposlenik_id,
    vehicleId: assignmentRow.vozilo_id,
    kmZavrsna: parsed.data.kmZavrsna,
  });

  if (releaseResult.status !== "success") {
    return releaseResult;
  }

  revalidateAssignmentPaths();
  return {
    ...releaseResult,
    payload: {
      assignmentId: assignmentRow.id,
      vehicleId: assignmentRow.vozilo_id,
      kmZavrsna: parsed.data.kmZavrsna,
    },
  };
}

export async function assignWorkerVehicleAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  void _previousState;

  const parsed = assignVehicleSchema.safeParse({
    vehicleId: formData.get("vehicleId"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Odaberi vozilo za novo zaduženje.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const sessionUser = await requireSessionUser({
    allowedRoles: ["zaposlenik", "admin"],
    redirectTo: "/prijava",
    forbiddenRedirectTo: "/dashboard",
  });

  const client = getDbClient();

  if (!client) {
    return {
      status: "error",
      message: "Supabase nije konfiguriran. Zaduženje nije spremljeno.",
    };
  }

  const existingActiveContext = await getActiveWorkerVehicleContext(sessionUser.employeeId);

  if (existingActiveContext) {
    return {
      status: "error",
      message: "Već imaš aktivno zaduženje. Prvo razduži postojeće vozilo.",
    };
  }

  const { data: busyAssignment, error: busyAssignmentError } = await client
    .from("zaduzenja")
    .select("id")
    .eq("vozilo_id", parsed.data.vehicleId)
    .eq("is_aktivno", true)
    .limit(1)
    .maybeSingle();

  if (busyAssignmentError) {
    console.error("[carlytics] Neuspješna provjera zauzetosti vozila:", busyAssignmentError.message);
    return {
      status: "error",
      message: "Neuspješna provjera stanja vozila. Pokušaj ponovno.",
    };
  }

  if (busyAssignment?.id) {
    return {
      status: "error",
      message: "Odabrano vozilo je u međuvremenu zauzeto. Odaberi drugo vozilo.",
    };
  }

  const { data: vehicleRow, error: vehicleError } = await client
    .from("vozila")
    .select("id, status_id, trenutna_km")
    .eq("id", parsed.data.vehicleId)
    .maybeSingle();

  if (vehicleError || !vehicleRow) {
    console.error("[carlytics] Neuspješan dohvat vozila za zaduženje:", vehicleError?.message);
    return {
      status: "error",
      message: "Odabrano vozilo nije dostupno.",
    };
  }

  if (vehicleRow.status_id) {
    const { data: statusRow } = await client
      .from("statusi_vozila")
      .select("naziv")
      .eq("id", vehicleRow.status_id)
      .maybeSingle();

    const normalizedStatus = normalizeStatusName(statusRow?.naziv);

    if (normalizedStatus.includes("serv")) {
      return {
        status: "error",
        message: "Odabrano vozilo je na servisu i ne može se zadužiti.",
      };
    }
  }

  const startedAtIso = getCurrentIsoTimestamp();

  const kmStart = vehicleRow.trenutna_km ?? 0;

  const { data: insertedAssignment, error: assignError } = await client
    .from("zaduzenja")
    .insert({
      vozilo_id: parsed.data.vehicleId,
      zaposlenik_id: sessionUser.employeeId,
      datum_od: startedAtIso,
      datum_do: null,
      is_aktivno: true,
      km_pocetna: kmStart,
      km_zavrsna: kmStart,
    })
    .select("id")
    .single();

  if (assignError) {
    console.error("[carlytics] Neuspješno spremanje novog zaduženja:", assignError.message);
    return {
      status: "error",
      message: "Novo zaduženje nije spremljeno. Pokušaj ponovno.",
    };
  }

  const occupiedStatusId = await resolveVehicleStatusId(client, "zauzeto");

  if (occupiedStatusId) {
    const { error: vehicleStatusError } = await client
      .from("vozila")
      .update({ status_id: occupiedStatusId })
      .eq("id", parsed.data.vehicleId);

    if (vehicleStatusError) {
      console.error(
        "[carlytics] Zaduženje uspjelo, ali status vozila nije ažuriran:",
        vehicleStatusError.message,
      );
    }
  }

  revalidateAssignmentPaths();

  return {
    status: "success",
    message: "Novo zaduženje vozila je uspješno spremljeno.",
    payload: {
      assignmentId: insertedAssignment?.id ?? null,
      vehicleId: parsed.data.vehicleId,
      kmStart,
      startedAtIso,
    },
  };
}
