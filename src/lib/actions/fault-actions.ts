"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/lib/actions/action-state";
import { requireSessionUser } from "@/lib/auth/session";
import { evaluateVehicleServiceDue } from "@/lib/fleet/service-due";
import { applyInterventionVisibilityFilter } from "@/lib/fleet/intervention-utils";
import { createOptionalServerSupabaseClient } from "@/lib/supabase/server";
import { createOptionalServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import { getActiveWorkerVehicleContext } from "@/lib/fleet/worker-context-service";
import type { Tables, TablesUpdate } from "@/types/database";
import { getCurrentIsoTimestamp, toDateOnlyInZagreb } from "@/lib/utils/date-format";

type VehicleStatusRow = Tables<"statusi_vozila">;

const FAULT_ATTACHMENTS_BUCKET = "kvarovi";
const MAX_FAULT_ATTACHMENT_SIZE_BYTES = 8 * 1024 * 1024;

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

const serviceInterventionUpdateSchema = z.object({
  interventionId: z.coerce.number().int().positive("Servisna intervencija je obavezna."),
  voziloId: z.coerce.number().int().positive("Vozilo je obavezno."),
  opis: z.string().trim().min(8, "Opis mora imati barem 8 znakova."),
  kategorijaId: z.coerce.number().int().positive().nullable().optional(),
  hitnost: z.enum(["nisko", "srednje", "visoko", "kriticno"]),
  statusPrijave: z.enum(["novo", "u_obradi", "zatvoreno"]),
  datumPocetka: z.string().min(1, "Datum početka je obavezan."),
  datumZavrsetka: z.preprocess((value) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    return String(value);
  }, z.string().nullable()),
  kmUTomTrenutku: z.coerce
    .number()
    .int("Kilometraža mora biti cijeli broj.")
    .nonnegative("Kilometraža ne može biti negativna."),
  cijena: z.preprocess((value) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    if (typeof value === "string") {
      return Number(value.replace(",", ".").trim());
    }

    return value;
  }, z.number().finite("Cijena mora biti broj.").nonnegative("Cijena ne može biti negativna.").nullable()),
});

const serviceInterventionLifecycleSchema = z.object({
  interventionId: z.coerce.number().int().positive("Servisna intervencija je obavezna."),
  razlogBrisanja: z.preprocess((value) => {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value).trim();
  }, z.string()),
});

const faultCloseCostSchema = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      return value.trim();
    }

    return "";
  },
  z
    .string()
    .min(1, "Cijena je obavezna pri zatvaranju prijave.")
    .transform((value) => Number(value.replace(",", ".")))
    .refine((value) => Number.isFinite(value), "Cijena mora biti broj.")
    .refine((value) => value >= 0, "Cijena ne može biti negativna."),
);

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
  statusType: "slobodno" | "servis",
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

    return normalized.includes("serv");
  });

  return match?.id ?? null;
}

function resolveServiceTypeFromDescription(description: string) {
  const normalized = description.toLowerCase();
  const hasSmall = normalized.includes("mali");
  const hasLarge = normalized.includes("veliki");

  if (hasSmall && hasLarge) {
    return "oba" as const;
  }

  if (hasSmall) {
    return "mali" as const;
  }

  if (hasLarge) {
    return "veliki" as const;
  }

  return "none" as const;
}

function normalizeFaultDescription(description: string) {
  const normalized = description.trim();

  return normalized.length > 0 ? normalized : "Bez opisa";
}

function toIsoDateOnly(date: Date) {
  return toDateOnlyInZagreb(date);
}

function getFaultAttachmentFile(formData: FormData) {
  const candidate = formData.get("fotografija");

  if (!(candidate instanceof File)) {
    return null;
  }

  if (!candidate.name || candidate.size <= 0) {
    return null;
  }

  return candidate;
}

function sanitizeFileNameSegment(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return normalized || "privitak";
}

function resolveFileExtension(file: File) {
  const extensionFromName = file.name.split(".").pop()?.toLowerCase();

  if (extensionFromName && /^[a-z0-9]+$/.test(extensionFromName)) {
    return extensionFromName;
  }

  if (file.type === "image/jpeg") {
    return "jpg";
  }

  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  if (file.type === "image/gif") {
    return "gif";
  }

  return "bin";
}

function validateFaultAttachment(file: File) {
  if (!file.type.startsWith("image/")) {
    return "Privitak mora biti slika (JPG, PNG, WEBP ili GIF).";
  }

  if (file.size > MAX_FAULT_ATTACHMENT_SIZE_BYTES) {
    return "Privitak je prevelik. Maksimalna veličina je 8 MB.";
  }

  return null;
}

async function uploadFaultAttachment(params: {
  client: NonNullable<ReturnType<typeof getDbClient>>;
  file: File;
  vehicleId: number;
  employeeId: number;
}) {
  const fileBaseName = sanitizeFileNameSegment(params.file.name.replace(/\.[^.]+$/, ""));
  const fileExtension = resolveFileExtension(params.file);
  const randomSuffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const storagePath = [
    "prijave-kvarova",
    toDateOnlyInZagreb(),
    `vozilo-${params.vehicleId}`,
    `zaposlenik-${params.employeeId}`,
    `${fileBaseName}-${randomSuffix}.${fileExtension}`,
  ].join("/");

  const storage = params.client.storage.from(FAULT_ATTACHMENTS_BUCKET);
  const { error: uploadError } = await storage.upload(storagePath, params.file, {
    contentType: params.file.type,
    upsert: false,
  });

  if (uploadError) {
    console.error("[carlytics] Neuspješan upload privitka prijave kvara:", uploadError.message);
    return {
      attachmentUrl: null,
      errorMessage: "Neuspješan upload fotografije kvara. Pokušaj ponovno.",
    };
  }

  const { data: publicUrlData } = storage.getPublicUrl(storagePath);

  if (!publicUrlData.publicUrl) {
    return {
      attachmentUrl: null,
      errorMessage: "Privitak je učitan, ali URL nije dostupan. Pokušaj ponovno.",
    };
  }

  return {
    attachmentUrl: publicUrlData.publicUrl,
    errorMessage: null,
  };
}

function revalidateFaultPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/flota");
  revalidatePath("/prijava-kvara");
  revalidatePath("/povijest-servisa");
}

async function resolveVehicleCurrentKm(
  client: NonNullable<ReturnType<typeof getDbClient>>,
  vehicleId: number,
) {
  const { data, error } = await client
    .from("vozila")
    .select("trenutna_km")
    .eq("id", vehicleId)
    .maybeSingle();

  if (error || !data) {
    console.error(
      "[carlytics] Neuspješan dohvat kilometraže vozila za prijavu kvara:",
      error?.message,
    );
    return null;
  }

  return data.trenutna_km ?? 0;
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
    allowedRoles: ["zaposlenik", "admin"],
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

  const opisProblema = parsed.data.opisProblema.trim();
  const attachmentFile = getFaultAttachmentFile(formData);
  let attachmentUrl: string | null = null;

  if (attachmentFile) {
    const attachmentValidationMessage = validateFaultAttachment(attachmentFile);

    if (attachmentValidationMessage) {
      return {
        status: "error",
        message: attachmentValidationMessage,
      };
    }

    const uploadResult = await uploadFaultAttachment({
      client,
      file: attachmentFile,
      vehicleId: activeContext.vehicleId,
      employeeId: sessionUser.employeeId,
    });

    if (uploadResult.errorMessage) {
      return {
        status: "error",
        message: uploadResult.errorMessage,
      };
    }

    attachmentUrl = uploadResult.attachmentUrl;
  }

  const { data: insertedFault, error } = await client
    .from("servisne_intervencije")
    .insert({
      opis: opisProblema,
      status_prijave: "novo",
      hitnost: parsed.data.hitnost,
      vozilo_id: activeContext.vehicleId,
      zaposlenik_id: sessionUser.employeeId,
      kategorija_id: parsed.data.kategorijaId ?? null,
      datum_pocetka: getCurrentIsoTimestamp(),
      datum_zavrsetka: null,
      km_u_tom_trenutku: activeContext.currentKm,
      attachment_url: attachmentUrl,
      cijena: null,
    })
    .select("id, datum_pocetka, vozilo_id, opis, hitnost, status_prijave, attachment_url")
    .single();

  if (error) {
    console.error("[carlytics] Neuspjelo spremanje prijave kvara:", error.message);
    return {
      status: "error",
      message: "Neuspjelo spremanje prijave. Pokušaj ponovno.",
    };
  }

  revalidateFaultPaths();
  revalidatePath("/m");
  revalidatePath("/m/prijava-kvara");

  return {
    status: "success",
    message: "Prijava kvara je uspješno poslana.",
    payload: {
      faultId: insertedFault?.id ?? null,
      reportedAtIso: insertedFault?.datum_pocetka ?? getCurrentIsoTimestamp(),
      vehicleId: insertedFault?.vozilo_id ?? activeContext.vehicleId,
      description: insertedFault?.opis ?? opisProblema,
      categoryId: parsed.data.kategorijaId ?? null,
      priority: insertedFault?.hitnost ?? parsed.data.hitnost,
      statusRaw: insertedFault?.status_prijave ?? "novo",
      attachmentUrl: insertedFault?.attachment_url ?? attachmentUrl,
      reporterName: sessionUser.fullName,
    },
  };
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
    allowedRoles: ["admin", "voditelj_flote"],
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

  const opisProblema = parsed.data.opisProblema.trim();
  const attachmentFile = getFaultAttachmentFile(formData);
  let attachmentUrl: string | null = null;

  if (attachmentFile) {
    const attachmentValidationMessage = validateFaultAttachment(attachmentFile);

    if (attachmentValidationMessage) {
      return {
        status: "error",
        message: attachmentValidationMessage,
      };
    }

    const uploadResult = await uploadFaultAttachment({
      client,
      file: attachmentFile,
      vehicleId: parsed.data.voziloId,
      employeeId: sessionUser.employeeId,
    });

    if (uploadResult.errorMessage) {
      return {
        status: "error",
        message: uploadResult.errorMessage,
      };
    }

    attachmentUrl = uploadResult.attachmentUrl;
  }

  const vehicleCurrentKm = await resolveVehicleCurrentKm(client, parsed.data.voziloId);

  if (vehicleCurrentKm === null) {
    return {
      status: "error",
      message: "Neuspješan dohvat kilometraže vozila. Pokušaj ponovno.",
    };
  }

  const { data: insertedFault, error } = await client
    .from("servisne_intervencije")
    .insert({
      opis: opisProblema,
      status_prijave: "novo",
      hitnost: parsed.data.hitnost,
      vozilo_id: parsed.data.voziloId,
      zaposlenik_id: sessionUser.employeeId,
      kategorija_id: parsed.data.kategorijaId ?? null,
      datum_pocetka: getCurrentIsoTimestamp(),
      datum_zavrsetka: null,
      km_u_tom_trenutku: vehicleCurrentKm,
      attachment_url: attachmentUrl,
      cijena: null,
    })
    .select("id, datum_pocetka, vozilo_id, opis, hitnost, status_prijave, attachment_url")
    .single();

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

  revalidateFaultPaths();

  return {
    status: "success",
    message: "Prijava kvara je uspješno poslana s desktopa.",
    payload: {
      faultId: insertedFault?.id ?? null,
      reportedAtIso: insertedFault?.datum_pocetka ?? getCurrentIsoTimestamp(),
      vehicleId: insertedFault?.vozilo_id ?? parsed.data.voziloId,
      description: insertedFault?.opis ?? opisProblema,
      categoryId: parsed.data.kategorijaId ?? null,
      priority: insertedFault?.hitnost ?? parsed.data.hitnost,
      statusRaw: insertedFault?.status_prijave ?? "novo",
      attachmentUrl: insertedFault?.attachment_url ?? attachmentUrl,
      reporterName: sessionUser.fullName,
    },
  };
}

export async function updateFaultStatusAction(formData: FormData) {
  const parsed = faultStatusUpdateSchema.safeParse({
    faultId: formData.get("faultId"),
    statusPrijave: formData.get("statusPrijave"),
  });

  if (!parsed.success) {
    console.warn("[carlytics] Neispravan payload za ažuriranje statusa prijave:", parsed.error.flatten().fieldErrors);
    return;
  }

  await requireSessionUser({
    allowedRoles: ["admin", "voditelj_flote"],
    redirectTo: "/prijava",
    forbiddenRedirectTo: "/m",
  });

  const client = getDbClient();

  if (!client) {
    console.error("[carlytics] Supabase nije konfiguriran za updateFaultStatusAction.");
    return;
  }

  if (parsed.data.statusPrijave !== "zatvoreno") {
    const { error } = await applyInterventionVisibilityFilter(
      client
        .from("servisne_intervencije")
        .update({ status_prijave: parsed.data.statusPrijave }),
    ).eq("id", parsed.data.faultId);

    if (error) {
      console.error("[carlytics] Neuspjelo ažuriranje statusa prijave:", error.message);
      return;
    }

    revalidateFaultPaths();
    return;
  }

  const parsedCloseCost = faultCloseCostSchema.safeParse(formData.get("cijena"));

  if (!parsedCloseCost.success) {
    console.error(
      "[carlytics] Zatvaranje prijave odbijeno: nedostaje valjana cijena.",
      parsedCloseCost.error.flatten().fieldErrors,
    );
    return;
  }

  const serviceCost = Number(parsedCloseCost.data.toFixed(2));
  const now = new Date();
  const nowIso = getCurrentIsoTimestamp(now);
  const nowDate = toIsoDateOnly(now);

  const { data: faultRow, error: faultFetchError } = await applyInterventionVisibilityFilter(
    client
      .from("servisne_intervencije")
      .select("id, vozilo_id, opis"),
  )
    .eq("id", parsed.data.faultId)
    .maybeSingle();

  if (faultFetchError || !faultRow) {
    console.error("[carlytics] Neuspješan dohvat prijave za zatvaranje:", faultFetchError?.message);
    return;
  }

  if (faultRow.vozilo_id) {
    const { data: vehicleRow, error: vehicleFetchError } = await client
      .from("vozila")
      .select(
        "id, model_id, status_id, datum_kupovine, trenutna_km, zadnji_mali_servis_datum, zadnji_mali_servis_km, zadnji_veliki_servis_datum, zadnji_veliki_servis_km",
      )
      .eq("id", faultRow.vozilo_id)
      .maybeSingle();

    if (vehicleFetchError || !vehicleRow) {
      console.error(
        "[carlytics] Neuspješan dohvat vozila za zatvaranje kvara:",
        vehicleFetchError?.message,
      );
      return;
    }

    const kmAtMoment = vehicleRow.trenutna_km ?? 0;
    const normalizedFaultDescription = normalizeFaultDescription(faultRow.opis ?? "");
    const serviceType = resolveServiceTypeFromDescription(normalizedFaultDescription);

    let smallServiceIntervalKm: number | null = null;
    let largeServiceIntervalKm: number | null = null;

    if (vehicleRow.model_id) {
      const { data: modelRow, error: modelError } = await client
        .from("modeli")
        .select("mali_servis_interval_km, veliki_servis_interval_km")
        .eq("id", vehicleRow.model_id)
        .maybeSingle();

      if (modelError) {
        console.error("[carlytics] Neuspješan dohvat modela za zatvaranje servisa:", modelError.message);
      } else if (modelRow) {
        smallServiceIntervalKm = modelRow.mali_servis_interval_km;
        largeServiceIntervalKm = modelRow.veliki_servis_interval_km;
      }
    }

    const updatedSmallServiceDate =
      serviceType === "mali" || serviceType === "oba"
        ? nowDate
        : vehicleRow.zadnji_mali_servis_datum ?? vehicleRow.datum_kupovine;
    const updatedSmallServiceKm =
      serviceType === "mali" || serviceType === "oba"
        ? kmAtMoment
        : vehicleRow.zadnji_mali_servis_km;
    const updatedLargeServiceDate =
      serviceType === "veliki" || serviceType === "oba"
        ? nowDate
        : vehicleRow.zadnji_veliki_servis_datum ?? vehicleRow.datum_kupovine;
    const updatedLargeServiceKm =
      serviceType === "veliki" || serviceType === "oba"
        ? kmAtMoment
        : vehicleRow.zadnji_veliki_servis_km;

    const serviceDue = evaluateVehicleServiceDue({
      currentKm: kmAtMoment,
      lastSmallServiceKm: updatedSmallServiceKm,
      lastLargeServiceKm: updatedLargeServiceKm,
      smallServiceIntervalKm,
      largeServiceIntervalKm,
      lastSmallServiceDate: updatedSmallServiceDate,
      lastLargeServiceDate: updatedLargeServiceDate,
    });

    const vehicleUpdatePayload: TablesUpdate<"vozila"> = {};

    if (serviceType === "mali" || serviceType === "oba") {
      vehicleUpdatePayload.zadnji_mali_servis_datum = nowDate;
      vehicleUpdatePayload.zadnji_mali_servis_km = kmAtMoment;
    }

    if (serviceType === "veliki" || serviceType === "oba") {
      vehicleUpdatePayload.zadnji_veliki_servis_datum = nowDate;
      vehicleUpdatePayload.zadnji_veliki_servis_km = kmAtMoment;
    }

    let shouldUpdateStatus = false;
    let targetStatus: "slobodno" | "servis" = "servis";

    if (serviceDue.isServiceDue) {
      shouldUpdateStatus = true;
      targetStatus = "servis";
    } else {
      const { data: currentStatusRow } = vehicleRow.status_id
        ? await client
            .from("statusi_vozila")
            .select("naziv")
            .eq("id", vehicleRow.status_id)
            .maybeSingle()
        : { data: null };

      if (normalizeStatusName(currentStatusRow?.naziv).includes("serv")) {
        shouldUpdateStatus = true;
        targetStatus = "slobodno";
      }
    }

    if (shouldUpdateStatus) {
      const targetStatusId = await resolveVehicleStatusId(client, targetStatus);

      if (targetStatusId) {
        vehicleUpdatePayload.status_id = targetStatusId;
      }
    }

    if (Object.keys(vehicleUpdatePayload).length > 0) {
      const { error: vehicleUpdateError } = await client
        .from("vozila")
        .update(vehicleUpdatePayload)
        .eq("id", vehicleRow.id);

      if (vehicleUpdateError) {
        console.error("[carlytics] Neuspješno ažuriranje vozila nakon zatvaranja kvara:", vehicleUpdateError.message);
        return;
      }
    }
  }

  const { error } = await applyInterventionVisibilityFilter(
    client
      .from("servisne_intervencije")
      .update({
        status_prijave: parsed.data.statusPrijave,
        datum_zavrsetka: nowIso,
        cijena: serviceCost,
      }),
  ).eq("id", parsed.data.faultId);

  if (error) {
    console.error("[carlytics] Neuspjelo ažuriranje statusa prijave:", error.message);
    return;
  }

  revalidateFaultPaths();
}

export async function updateServiceInterventionAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = serviceInterventionUpdateSchema.safeParse({
    interventionId: formData.get("interventionId"),
    voziloId: formData.get("voziloId"),
    opis: formData.get("opis"),
    kategorijaId: formData.get("kategorijaId") || null,
    hitnost: formData.get("hitnost") || "srednje",
    statusPrijave: formData.get("statusPrijave") || "novo",
    datumPocetka: formData.get("datumPocetka"),
    datumZavrsetka: formData.get("datumZavrsetka"),
    kmUTomTrenutku: formData.get("kmUTomTrenutku"),
    cijena: formData.get("cijena"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Provjeri podatke servisne intervencije.",
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
      message: "Supabase nije konfiguriran. Intervencija nije ažurirana.",
    };
  }

  if (parsed.data.statusPrijave === "zatvoreno" && !parsed.data.datumZavrsetka) {
    return {
      status: "error",
      message: "Za zatvorenu intervenciju unesi datum završetka.",
      fieldErrors: {
        datumZavrsetka: ["Datum završetka je obavezan za zatvoreni status."],
      },
    };
  }

  const updatePayload: TablesUpdate<"servisne_intervencije"> = {
    vozilo_id: parsed.data.voziloId,
    opis: parsed.data.opis,
    kategorija_id: parsed.data.kategorijaId ?? null,
    hitnost: parsed.data.hitnost,
    status_prijave: parsed.data.statusPrijave,
    datum_pocetka: parsed.data.datumPocetka,
    datum_zavrsetka: parsed.data.datumZavrsetka,
    km_u_tom_trenutku: parsed.data.kmUTomTrenutku,
    cijena: parsed.data.cijena,
  };

  const { error } = await client
    .from("servisne_intervencije")
    .update(updatePayload)
    .eq("id", parsed.data.interventionId)
    .is("obrisano_u", null);

  if (error) {
    console.error("[carlytics] Neuspjelo uređivanje servisne intervencije:", error.message);
    return {
      status: "error",
      message: "Intervencija nije ažurirana. Pokušaj ponovno.",
    };
  }

  revalidateFaultPaths();
  revalidatePath(`/flota/${parsed.data.voziloId}`);

  return {
    status: "success",
    message: "Servisna intervencija je uspješno ažurirana.",
  };
}

export async function deleteServiceInterventionAction(formData: FormData) {
  const parsed = serviceInterventionLifecycleSchema.safeParse({
    interventionId: formData.get("interventionId"),
    razlogBrisanja: formData.get("razlogBrisanja"),
  });

  if (!parsed.success || parsed.data.razlogBrisanja.length < 3) {
    console.warn("[carlytics] Brisanje servisne intervencije odbijeno: neispravan payload ili razlog.");
    return;
  }

  const sessionUser = await requireSessionUser({
    allowedRoles: ["admin", "voditelj_flote"],
    redirectTo: "/prijava",
    forbiddenRedirectTo: "/m",
  });

  const client = getDbClient();

  if (!client) {
    console.error("[carlytics] Supabase nije konfiguriran za deleteServiceInterventionAction.");
    return;
  }

  const { error } = await client
    .from("servisne_intervencije")
    .update({
      obrisano_u: getCurrentIsoTimestamp(),
      obrisao_zaposlenik_id: sessionUser.employeeId,
      razlog_brisanja: parsed.data.razlogBrisanja,
    })
    .eq("id", parsed.data.interventionId)
    .is("obrisano_u", null);

  if (error) {
    console.error("[carlytics] Neuspjelo soft brisanje servisne intervencije:", error.message);
    return;
  }

  revalidateFaultPaths();
}

export async function restoreServiceInterventionAction(formData: FormData) {
  const parsed = serviceInterventionLifecycleSchema.safeParse({
    interventionId: formData.get("interventionId"),
    razlogBrisanja: "",
  });

  if (!parsed.success) {
    console.warn("[carlytics] Vraćanje servisne intervencije odbijeno: neispravan payload.");
    return;
  }

  await requireSessionUser({
    allowedRoles: ["admin", "voditelj_flote"],
    redirectTo: "/prijava",
    forbiddenRedirectTo: "/m",
  });

  const client = getDbClient();

  if (!client) {
    console.error("[carlytics] Supabase nije konfiguriran za restoreServiceInterventionAction.");
    return;
  }

  const { error } = await client
    .from("servisne_intervencije")
    .update({
      obrisano_u: null,
      obrisao_zaposlenik_id: null,
      razlog_brisanja: null,
    })
    .eq("id", parsed.data.interventionId);

  if (error) {
    console.error("[carlytics] Neuspjelo vraćanje servisne intervencije:", error.message);
    return;
  }

  revalidateFaultPaths();
}
