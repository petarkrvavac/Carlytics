"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/lib/actions/action-state";
import { requireSessionUser } from "@/lib/auth/session";
import { getActiveWorkerVehicleContext } from "@/lib/fleet/worker-context-service";
import { createOptionalServerSupabaseClient } from "@/lib/supabase/server";
import { createOptionalServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type { Tables } from "@/types/database";

type VehicleStatusRow = Tables<"statusi_vozila">;

const assignVehicleSchema = z.object({
  vehicleId: z.coerce.number().int().positive("Odaberi vozilo koje zadužuješ."),
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
  statusType: "slobodno" | "zauzeto",
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
}

export async function releaseWorkerVehicleAction(
  _previousState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  void _previousState;
  void _formData;

  const sessionUser = await requireSessionUser({
    allowedRoles: ["radnik", "admin"],
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

  const finishedAtIso = new Date().toISOString();

  const { error: releaseError } = await client
    .from("zaduzenja")
    .update({
      is_aktivno: false,
      datum_do: finishedAtIso,
      km_zavrsna: activeContext.currentKm,
    })
    .eq("id", activeContext.assignmentId)
    .eq("zaposlenik_id", sessionUser.employeeId)
    .eq("is_aktivno", true);

  if (releaseError) {
    console.error("[carlytics] Neuspješno razduženje vozila:", releaseError.message);
    return {
      status: "error",
      message: "Razduženje nije uspjelo. Pokušaj ponovno.",
    };
  }

  const freeStatusId = await resolveVehicleStatusId(client, "slobodno");

  if (freeStatusId) {
    const { error: vehicleStatusError } = await client
      .from("vozila")
      .update({ status_id: freeStatusId })
      .eq("id", activeContext.vehicleId);

    if (vehicleStatusError) {
      console.error(
        "[carlytics] Razduženje uspjelo, ali status vozila nije ažuriran:",
        vehicleStatusError.message,
      );
    }
  }

  revalidateAssignmentPaths();

  return {
    status: "success",
    message: `Vozilo je razduženo. Datum razduženja je spremljen (${new Date(finishedAtIso).toLocaleString("hr-HR")}).`,
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
    allowedRoles: ["radnik", "admin"],
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

  const startedAtIso = new Date().toISOString();

  const { error: assignError } = await client.from("zaduzenja").insert({
    vozilo_id: parsed.data.vehicleId,
    zaposlenik_id: sessionUser.employeeId,
    datum_od: startedAtIso,
    datum_do: null,
    is_aktivno: true,
    km_pocetna: vehicleRow.trenutna_km ?? 0,
    km_zavrsna: null,
  });

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
  };
}
