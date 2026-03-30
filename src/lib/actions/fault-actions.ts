"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionState } from "@/lib/actions/action-state";
import { requireSessionUser } from "@/lib/auth/session";
import { createOptionalServerSupabaseClient } from "@/lib/supabase/server";
import { createOptionalServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import { getActiveWorkerVehicleContext } from "@/lib/fleet/worker-context-service";

const faultFormSchema = z.object({
  opisProblema: z
    .string()
    .trim()
    .min(8, "Opis problema mora imati barem 8 znakova."),
  kategorijaId: z.coerce.number().int().positive().nullable().optional(),
  hitnost: z.enum(["nisko", "srednje", "visoko", "kriticno"]),
});

const desktopFaultFormSchema = faultFormSchema.extend({
  voziloId: z.coerce.number().int().positive("Vozilo je obavezno."),
});

const faultStatusUpdateSchema = z.object({
  faultId: z.coerce.number().int().positive(),
  statusPrijave: z.enum(["novo", "u_obradi", "zatvoreno"]),
});

function getDbClient() {
  return createOptionalServiceRoleSupabaseClient() ?? createOptionalServerSupabaseClient();
}

async function resolveFaultCategoryPrefix(
  client: NonNullable<ReturnType<typeof getDbClient>>,
  kategorijaId: number | null | undefined,
) {
  if (!kategorijaId) {
    return "";
  }

  const { data: kategorijaData } = await client
    .from("kategorije_kvarova")
    .select("naziv")
    .eq("id", kategorijaId)
    .maybeSingle();

  if (!kategorijaData?.naziv) {
    return "";
  }

  return `[${kategorijaData.naziv}] `;
}

export async function submitFaultReportAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = faultFormSchema.safeParse({
    opisProblema: formData.get("opisProblema"),
    kategorijaId: formData.get("kategorijaId") || null,
    hitnost: formData.get("hitnost") || "srednje",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Provjeri unesene podatke.",
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
      message: "Supabase nije konfiguriran. Prijava nije poslana.",
    };
  }

  const activeContext = await getActiveWorkerVehicleContext(sessionUser.employeeId);

  if (!activeContext) {
    return {
      status: "error",
      message: "Nemate aktivno zaduženje vozila. Obratite se administratoru.",
    };
  }

  const kategorijaPrefix = await resolveFaultCategoryPrefix(
    client,
    parsed.data.kategorijaId,
  );

  const opisProblema = `${kategorijaPrefix}${parsed.data.opisProblema}`.trim();

  const { error } = await client.from("prijave_kvarova").insert({
    opis_problema: opisProblema,
    status_prijave: "novo",
    hitnost: parsed.data.hitnost,
    vozilo_id: activeContext.vehicleId,
    zaposlenik_id: sessionUser.employeeId,
    servis_id: null,
    datum_prijave: new Date().toISOString(),
  });

  if (error) {
    console.error("[carlytics] Neuspjelo spremanje prijave kvara:", error.message);
    return {
      status: "error",
      message: "Neuspjelo spremanje prijave. Pokušaj ponovno.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/flota");
  revalidatePath("/prijava-kvara");
  revalidatePath("/servisni-centar");
  revalidatePath("/m");
  revalidatePath("/m/prijava-kvara");

  redirect("/m");
}

export async function submitDesktopFaultReportAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = desktopFaultFormSchema.safeParse({
    voziloId: formData.get("voziloId"),
    opisProblema: formData.get("opisProblema"),
    kategorijaId: formData.get("kategorijaId") || null,
    hitnost: formData.get("hitnost") || "srednje",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Provjeri unesene podatke.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const sessionUser = await requireSessionUser({
    allowedRoles: ["admin", "serviser"],
    redirectTo: "/prijava",
    forbiddenRedirectTo: "/m",
  });

  const client = getDbClient();

  if (!client) {
    return {
      status: "error",
      message: "Supabase nije konfiguriran. Prijava nije poslana.",
    };
  }

  const kategorijaPrefix = await resolveFaultCategoryPrefix(
    client,
    parsed.data.kategorijaId,
  );

  const opisProblema = `${kategorijaPrefix}${parsed.data.opisProblema}`.trim();

  const { error } = await client.from("prijave_kvarova").insert({
    opis_problema: opisProblema,
    status_prijave: "novo",
    hitnost: parsed.data.hitnost,
    vozilo_id: parsed.data.voziloId,
    zaposlenik_id: sessionUser.employeeId,
    servis_id: null,
    datum_prijave: new Date().toISOString(),
  });

  if (error) {
    console.error(
      "[carlytics] Neuspjelo desktop spremanje prijave kvara:",
      error.message,
    );
    return {
      status: "error",
      message: "Neuspjelo spremanje prijave. Pokušaj ponovno.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/flota");
  revalidatePath("/prijava-kvara");
  revalidatePath("/servisni-centar");

  return {
    status: "success",
    message: "Prijava kvara je uspješno poslana s desktopa.",
  };
}

export async function updateFaultStatusAction(formData: FormData) {
  const parsed = faultStatusUpdateSchema.safeParse({
    faultId: formData.get("faultId"),
    statusPrijave: formData.get("statusPrijave"),
  });

  if (!parsed.success) {
    return;
  }

  await requireSessionUser({
    allowedRoles: ["admin", "serviser"],
    redirectTo: "/prijava",
    forbiddenRedirectTo: "/m",
  });

  const client = getDbClient();

  if (!client) {
    return;
  }

  const { error } = await client
    .from("prijave_kvarova")
    .update({ status_prijave: parsed.data.statusPrijave })
    .eq("id", parsed.data.faultId);

  if (error) {
    console.error("[carlytics] Neuspjelo ažuriranje statusa prijave:", error.message);
    return;
  }

  revalidatePath("/dashboard");
  revalidatePath("/flota");
  revalidatePath("/prijava-kvara");
  revalidatePath("/servisni-centar");
}
