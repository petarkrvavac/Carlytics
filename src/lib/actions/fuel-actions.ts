"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionState } from "@/lib/actions/action-state";
import { requireSessionUser } from "@/lib/auth/session";
import { getActiveWorkerVehicleContext } from "@/lib/fleet/worker-context-service";
import { createOptionalServerSupabaseClient } from "@/lib/supabase/server";
import { createOptionalServiceRoleSupabaseClient } from "@/lib/supabase/service-role";

interface DbErrorLike {
  code?: string | null;
  message?: string;
}

const fuelFormSchema = z.object({
  kmTocenja: z.coerce
    .number()
    .int("Kilometraža mora biti cijeli broj.")
    .positive("Kilometraža mora biti veća od 0."),
  litraza: z.coerce
    .number()
    .positive("Litraža mora biti veća od 0."),
  cijenaPoLitri: z.coerce
    .number()
    .positive("Cijena po litri mora biti veća od 0."),
});

function getDbClient() {
  return createOptionalServiceRoleSupabaseClient() ?? createOptionalServerSupabaseClient();
}

function revalidateFuelPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/flota");
  revalidatePath("/gorivo");
  revalidatePath("/m");
  revalidatePath("/m/gorivo");
}

function mapFuelInsertError(error: DbErrorLike) {
  const code = error.code ?? "";
  const rawMessage = error.message ?? "";
  const message = rawMessage.toLowerCase();

  if (code === "42501" || message.includes("row-level security")) {
    return "Nemate ovlasti za unos goriva za trenutno zaduženje.";
  }

  if (code === "PGRST301" || message.includes("jwt") || message.includes("unauthorized")) {
    return "Autentikacija prema bazi nije valjana. Ponovno se prijavite i pokušajte opet.";
  }

  if (code === "PGRST204") {
    return "Upit prema bazi nije valjan (nedostaje relacija ili stupac).";
  }

  if (code === "23503") {
    return "Unos goriva nije valjan jer zaduženje ili povezano vozilo više ne postoji.";
  }

  if (code === "23505") {
    return "Unos goriva već postoji za isti ključ zapisa.";
  }

  if (code === "23514") {
    return "Unos goriva nije prošao provjeru baze (raspon vrijednosti nije valjan).";
  }

  if (code === "22P02") {
    return "Uneseni podaci imaju neispravan format.";
  }

  const compactReason = rawMessage.replace(/\s+/g, " ").trim();

  if (compactReason) {
    return `Unos goriva nije spremljen: ${compactReason}`;
  }

  return "Unos goriva nije spremljen zbog nepoznate greške baze.";
}

export async function submitFuelEntryAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = fuelFormSchema.safeParse({
    kmTocenja: formData.get("kmTocenja"),
    litraza: formData.get("litraza"),
    cijenaPoLitri: formData.get("cijenaPoLitri"),
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
      message: "Supabase nije konfiguriran. Unos nije spremljen.",
    };
  }

  const activeContext = await getActiveWorkerVehicleContext(sessionUser.employeeId);

  if (!activeContext) {
    return {
      status: "error",
      message: "Nemate aktivno zaduženje vozila. Obratite se administratoru.",
    };
  }

  if (parsed.data.kmTocenja < activeContext.currentKm) {
    return {
      status: "error",
      message: `Nova kilometraža mora biti >= ${activeContext.currentKm.toLocaleString("hr-HR")} km.`,
    };
  }

  if (activeContext.fuelCapacity > 0 && parsed.data.litraza > activeContext.fuelCapacity) {
    return {
      status: "error",
      message: `Ne možete unijeti više od ${activeContext.fuelCapacity} L za ovo vozilo.`,
    };
  }

  const ukupniIznos = Number(
    (parsed.data.litraza * parsed.data.cijenaPoLitri).toFixed(2),
  );

  const { error: insertError } = await client.from("evidencija_goriva").insert({
    datum: new Date().toISOString(),
    km_tocenja: parsed.data.kmTocenja,
    litraza: parsed.data.litraza,
    cijena_po_litri: parsed.data.cijenaPoLitri,
    zaduzenje_id: activeContext.assignmentId,
  });

  if (insertError) {
    console.error("[carlytics] Neuspjelo spremanje goriva:", {
      code: insertError.code,
      message: insertError.message,
    });
    return {
      status: "error",
      message: mapFuelInsertError(insertError),
    };
  }

  const postInsertErrors: string[] = [];

  const { error: updateVehicleError } = await client
    .from("vozila")
    .update({ trenutna_km: parsed.data.kmTocenja })
    .eq("id", activeContext.vehicleId);

  if (updateVehicleError) {
    console.error("[carlytics] Djelomični neuspjeh nakon unosa goriva (vozilo):", {
      code: updateVehicleError.code,
      message: updateVehicleError.message,
    });
    postInsertErrors.push("kilometraža vozila nije ažurirana");
  }

  const { error: updateAssignmentError } = await client
    .from("zaduzenja")
    .update({ km_zavrsna: parsed.data.kmTocenja })
    .eq("id", activeContext.assignmentId);

  if (updateAssignmentError) {
    console.error("[carlytics] Djelomični neuspjeh nakon unosa goriva (zaduženje):", {
      code: updateAssignmentError.code,
      message: updateAssignmentError.message,
    });
    postInsertErrors.push("kilometraža na zaduženju nije ažurirana");
  }

  revalidateFuelPaths();

  if (postInsertErrors.length > 0) {
    return {
      status: "error",
      message: `Unos goriva je spremljen, ali ${postInsertErrors.join(" i ")}.`,
    };
  }

  void ukupniIznos;
  redirect("/m");
}
