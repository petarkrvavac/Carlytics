"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/lib/actions/action-state";
import { requireSessionUser } from "@/lib/auth/session";
import { createOptionalServerSupabaseClient } from "@/lib/supabase/server";
import { createOptionalServiceRoleSupabaseClient } from "@/lib/supabase/service-role";

function basicValidacija(vin: string) {
  if (vin.length !== 17) {
    return false;
  }

  if (/[IOQ]/.test(vin)) {
    return false;
  }

  return true;
}

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

const optionalDateSchema = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  return String(value);
}, z.string().optional());

const optionalNumberSchema = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  return Number(value);
}, z.number().nonnegative().optional());

const optionalIntegerSchema = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  return Number(value);
}, z.number().int().positive().optional());

const optionalKmIntervalSchema = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  return Number(value);
}, z.number().int().nonnegative().optional());

const optionalTextSchema = z.preprocess((value) => {
  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = normalizeLabel(String(value));
  return normalized === "" ? undefined : normalized;
}, z.string().optional());

const addVehicleSchema = z.object({
  brojSasije: z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => basicValidacija(value), {
      message: "VIN mora imati 17 znakova i ne smije sadržavati I, O ili Q.",
    }),
  registracijskaOznaka: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, "Registracija mora imati barem 3 znaka."),
  modelId: optionalIntegerSchema,
  proizvodjacId: optionalIntegerSchema,
  noviModelNaziv: optionalTextSchema,
  noviProizvodjacNaziv: optionalTextSchema,
  kapacitetRezervoara: optionalNumberSchema,
  tipGorivaId: optionalIntegerSchema,
  maliServisIntervalKm: optionalKmIntervalSchema,
  velikiServisIntervalKm: optionalKmIntervalSchema,
  statusId: z.coerce.number().int().positive("Status je obavezan."),
  trenutnaKm: z.coerce
    .number()
    .int("Kilometraža mora biti cijeli broj.")
    .nonnegative("Kilometraža ne može biti negativna."),
  datumKupovine: optionalDateSchema,
  nabavnaVrijednost: optionalNumberSchema,
  datumIstekaRegistracije: z.string().min(1, "Datum isteka registracije je obavezan."),
});

const extendVehicleRegistrationSchema = z.object({
  vehicleId: z.coerce.number().int().positive("Vozilo je obavezno."),
  datumIstekaRegistracije: z.string().min(1, "Novi datum isteka je obavezan."),
  cijenaRegistracije: z.preprocess(
    (value) => {
      if (typeof value === "string") {
        const normalized = value.replace(",", ".").trim();
        return normalized === "" ? Number.NaN : Number(normalized);
      }

      return value;
    },
    z
      .number()
      .finite("Cijena registracije mora biti broj.")
      .nonnegative("Cijena registracije ne može biti negativna."),
  ),
});

const updateVehicleActivationSchema = z.object({
  vehicleId: z.coerce.number().int().positive("Vozilo je obavezno."),
  isAktivan: z.enum(["true", "false"]),
  razlogDeaktivacije: z.preprocess((value) => {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value).trim();
  }, z.string()),
});

function getDbClient() {
  return createOptionalServiceRoleSupabaseClient() ?? createOptionalServerSupabaseClient();
}

function isValidDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function getDaysUntilDateOnly(value: string) {
  if (!isValidDateOnly(value)) {
    return null;
  }

  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const now = new Date();
  const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const targetUtcMs = Date.UTC(year, month - 1, day);

  return Math.ceil((targetUtcMs - todayUtcMs) / (1000 * 60 * 60 * 24));
}

export async function extendVehicleRegistrationAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = extendVehicleRegistrationSchema.safeParse({
    vehicleId: formData.get("vehicleId"),
    datumIstekaRegistracije: formData.get("datumIstekaRegistracije"),
    cijenaRegistracije: formData.get("cijenaRegistracije"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Provjeri unesene podatke za produženje registracije.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  if (!isValidDateOnly(parsed.data.datumIstekaRegistracije)) {
    return {
      status: "error",
      message: "Unesi ispravan datum isteka registracije.",
      fieldErrors: {
        datumIstekaRegistracije: ["Datum nije u ispravnom formatu."],
      },
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
      message: "Supabase nije konfiguriran. Registracija nije produžena.",
    };
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  if (parsed.data.datumIstekaRegistracije < todayIso) {
    return {
      status: "error",
      message: "Datum isteka mora biti danas ili u budućnosti.",
      fieldErrors: {
        datumIstekaRegistracije: ["Unesi datum koji nije u prošlosti."],
      },
    };
  }

  const { data: registrationRow, error: registrationFetchError } = await client
    .from("registracije")
    .select("id, datum_isteka, registracijska_oznaka")
    .eq("vozilo_id", parsed.data.vehicleId)
    .order("datum_isteka", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (registrationFetchError) {
    console.error(
      "[carlytics] Neuspješan dohvat registracije za produženje:",
      registrationFetchError.message,
    );

    return {
      status: "error",
      message: "Neuspješan dohvat postojeće registracije.",
    };
  }

  if (!registrationRow) {
    return {
      status: "error",
      message: "Vozilo nema registraciju za produženje.",
    };
  }

  const daysUntilExpiry = getDaysUntilDateOnly(registrationRow.datum_isteka);

  if (daysUntilExpiry !== null && daysUntilExpiry > 30) {
    return {
      status: "error",
      message: "Registraciju je moguće produžiti unutar 30 dana do isteka.",
    };
  }

  if (parsed.data.datumIstekaRegistracije <= registrationRow.datum_isteka) {
    return {
      status: "error",
      message: "Novi datum isteka mora biti nakon trenutnog datuma isteka registracije.",
      fieldErrors: {
        datumIstekaRegistracije: ["Odaberi datum nakon postojeće registracije."],
      },
    };
  }

  const registrationPrice = Number(parsed.data.cijenaRegistracije.toFixed(2));

  const { error: registrationInsertError } = await client
    .from("registracije")
    .insert({
      datum_registracije: todayIso,
      datum_isteka: parsed.data.datumIstekaRegistracije,
      cijena: registrationPrice,
      registracijska_oznaka: registrationRow.registracijska_oznaka,
      vozilo_id: parsed.data.vehicleId,
    })
    ;

  if (registrationInsertError) {
    console.error(
      "[carlytics] Neuspješno produženje registracije:",
      registrationInsertError.message,
    );

    return {
      status: "error",
      message: "Produženje registracije nije uspjelo. Pokušaj ponovno.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/flota");
  revalidatePath(`/flota/${parsed.data.vehicleId}`);

  return {
    status: "success",
    message: `Registracija je produžena do ${parsed.data.datumIstekaRegistracije} (cijena ${registrationPrice.toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR).`,
  };
}

export async function updateVehicleActivationAction(formData: FormData) {
  const parsed = updateVehicleActivationSchema.safeParse({
    vehicleId: formData.get("vehicleId"),
    isAktivan: formData.get("isAktivan"),
    razlogDeaktivacije: formData.get("razlogDeaktivacije"),
  });

  if (!parsed.success) {
    console.warn("[carlytics] Neispravan payload za updateVehicleActivationAction:", parsed.error.flatten().fieldErrors);
    return;
  }

  await requireSessionUser({
    allowedRoles: ["admin", "voditelj_flote"],
    redirectTo: "/prijava",
    forbiddenRedirectTo: "/m",
  });

  const client = getDbClient();

  if (!client) {
    console.error("[carlytics] Supabase nije konfiguriran za updateVehicleActivationAction.");
    return;
  }

  const nextIsActive = parsed.data.isAktivan === "true";
  const deactivationReason = parsed.data.razlogDeaktivacije;

  if (!nextIsActive && deactivationReason.length < 3) {
    console.warn("[carlytics] Deaktivacija vozila odbijena: razlog je prekratak.");
    return;
  }

  const { error } = await client
    .from("vozila")
    .update({
      is_aktivan: nextIsActive,
      razlog_deaktivacije: nextIsActive ? null : deactivationReason,
    })
    .eq("id", parsed.data.vehicleId);

  if (error) {
    console.error("[carlytics] Neuspjelo ažuriranje statusa vozila:", error.message);
    return;
  }

  revalidatePath("/dashboard");
  revalidatePath("/flota");
  revalidatePath(`/flota/${parsed.data.vehicleId}`);
}

export async function submitNewVehicleAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = addVehicleSchema.safeParse({
    brojSasije: formData.get("brojSasije"),
    registracijskaOznaka: formData.get("registracijskaOznaka"),
    modelId: formData.get("modelId"),
    proizvodjacId: formData.get("proizvodjacId"),
    noviModelNaziv: formData.get("noviModelNaziv"),
    noviProizvodjacNaziv: formData.get("noviProizvodjacNaziv"),
    kapacitetRezervoara: formData.get("kapacitetRezervoara"),
    tipGorivaId: formData.get("tipGorivaId"),
    maliServisIntervalKm: formData.get("maliServisIntervalKm"),
    velikiServisIntervalKm: formData.get("velikiServisIntervalKm"),
    statusId: formData.get("statusId"),
    trenutnaKm: formData.get("trenutnaKm"),
    datumKupovine: formData.get("datumKupovine"),
    nabavnaVrijednost: formData.get("nabavnaVrijednost"),
    datumIstekaRegistracije: formData.get("datumIstekaRegistracije"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Provjeri unesene podatke.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const hasExistingModel = Boolean(parsed.data.modelId);
  const hasNewModel = Boolean(parsed.data.noviModelNaziv);

  if (!hasExistingModel && !hasNewModel) {
    return {
      status: "error",
      message: "Odaberi postojeći model ili unesi novi model.",
      fieldErrors: {
        modelSelection: ["Model je obavezan."],
      },
    };
  }

  if (hasExistingModel && hasNewModel) {
    return {
      status: "error",
      message: "Odaberi jedan put: postojeći model ili kreiranje novog modela.",
      fieldErrors: {
        modelSelection: ["Ne možeš istovremeno odabrati i kreirati model."],
      },
    };
  }

  if (hasNewModel) {
    const hasExistingManufacturer = Boolean(parsed.data.proizvodjacId);
    const hasNewManufacturer = Boolean(parsed.data.noviProizvodjacNaziv);

    if (!hasExistingManufacturer && !hasNewManufacturer) {
      return {
        status: "error",
        message: "Za novi model odaberi postojeći ili upiši novi naziv proizvođača.",
        fieldErrors: {
          proizvodjacId: ["Proizvođač je obavezan kada kreiraš novi model."],
        },
      };
    }

    if (hasExistingManufacturer && hasNewManufacturer) {
      return {
        status: "error",
        message: "Odaberi jednog proizvođača ili upiši novi naziv, ne oboje.",
        fieldErrors: {
          noviProizvodjacNaziv: ["Koristi ili postojeći ili novi proizvođač."],
        },
      };
    }
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
      message: "Supabase nije konfiguriran. Vozilo nije spremljeno.",
    };
  }

  let resolvedModelId = parsed.data.modelId ?? null;

  if (hasNewModel) {
    let resolvedManufacturerId = parsed.data.proizvodjacId ?? null;

    if (!resolvedManufacturerId && parsed.data.noviProizvodjacNaziv) {
      const normalizedManufacturerName = parsed.data.noviProizvodjacNaziv;

      const { data: existingManufacturerRows, error: existingManufacturerError } = await client
        .from("proizvodjaci")
        .select("id")
        .ilike("naziv", normalizedManufacturerName)
        .limit(1);

      if (existingManufacturerError) {
        console.error(
          "[carlytics] Neuspjela provjera postojećeg proizvođača:",
          existingManufacturerError.message,
        );

        return {
          status: "error",
          message: "Neuspjela provjera proizvođača. Pokušaj ponovno.",
        };
      }

      const existingManufacturerId = existingManufacturerRows?.[0]?.id;

      if (existingManufacturerId) {
        resolvedManufacturerId = existingManufacturerId;
      } else {
        const { data: insertedManufacturer, error: manufacturerInsertError } = await client
          .from("proizvodjaci")
          .insert({ naziv: normalizedManufacturerName })
          .select("id")
          .single();

        if (manufacturerInsertError || !insertedManufacturer) {
          console.error(
            "[carlytics] Neuspjelo kreiranje proizvođača:",
            manufacturerInsertError?.message,
          );

          return {
            status: "error",
            message: "Novi proizvođač nije spremljen. Pokušaj ponovno.",
          };
        }

        resolvedManufacturerId = insertedManufacturer.id;
      }
    }

    if (!resolvedManufacturerId) {
      return {
        status: "error",
        message: "Nije moguće odrediti proizvođača za novi model.",
      };
    }

    const normalizedModelName = parsed.data.noviModelNaziv!;

    const { data: existingModelRows, error: existingModelError } = await client
      .from("modeli")
      .select("id")
      .eq("proizvodjac_id", resolvedManufacturerId)
      .ilike("naziv", normalizedModelName)
      .limit(1);

    if (existingModelError) {
      console.error("[carlytics] Neuspjela provjera postojećeg modela:", existingModelError.message);

      return {
        status: "error",
        message: "Neuspjela provjera modela. Pokušaj ponovno.",
      };
    }

    const existingModelId = existingModelRows?.[0]?.id;

    if (existingModelId) {
      resolvedModelId = existingModelId;
    } else {
      const { data: insertedModel, error: modelInsertError } = await client
        .from("modeli")
        .insert({
          naziv: normalizedModelName,
          proizvodjac_id: resolvedManufacturerId,
          kapacitet_rezervoara: parsed.data.kapacitetRezervoara ?? null,
          tip_goriva_id: parsed.data.tipGorivaId ?? null,
          mali_servis_interval_km: parsed.data.maliServisIntervalKm ?? null,
          veliki_servis_interval_km: parsed.data.velikiServisIntervalKm ?? null,
        })
        .select("id")
        .single();

      if (modelInsertError || !insertedModel) {
        console.error("[carlytics] Neuspjelo kreiranje modela:", modelInsertError?.message);

        return {
          status: "error",
          message: "Novi model nije spremljen. Pokušaj ponovno.",
        };
      }

      resolvedModelId = insertedModel.id;
    }
  }

  if (!resolvedModelId) {
    return {
      status: "error",
      message: "Model nije moguće odrediti.",
      fieldErrors: {
        modelSelection: ["Model je obavezan."],
      },
    };
  }

  const normalizedPlate = parsed.data.registracijskaOznaka;
  const normalizedVin = parsed.data.brojSasije;

  const { data: existingRegistration } = await client
    .from("registracije")
    .select("vozilo_id")
    .eq("registracijska_oznaka", normalizedPlate)
    .maybeSingle();

  if (existingRegistration?.vozilo_id) {
    return {
      status: "error",
      message: `Ova registracija je već pridružena vozilu #${existingRegistration.vozilo_id}.`,
      fieldErrors: {
        registracijskaOznaka: ["Registracija već postoji u sustavu."],
      },
    };
  }

  const { data: existingVin } = await client
    .from("vozila")
    .select("id")
    .eq("broj_sasije", normalizedVin)
    .maybeSingle();

  if (existingVin?.id) {
    return {
      status: "error",
      message: `VIN je već pridružen vozilu #${existingVin.id}.`,
      fieldErrors: {
        brojSasije: ["VIN već postoji u sustavu."],
      },
    };
  }

  const initialServiceDate = parsed.data.datumKupovine ?? new Date().toISOString().slice(0, 10);

  const { data: insertedVehicle, error: vehicleInsertError } = await client
    .from("vozila")
    .insert({
      broj_sasije: normalizedVin,
      model_id: resolvedModelId,
      status_id: parsed.data.statusId,
      trenutna_km: parsed.data.trenutnaKm,
      zadnji_mali_servis_datum: initialServiceDate,
      zadnji_mali_servis_km: parsed.data.trenutnaKm,
      zadnji_veliki_servis_datum: initialServiceDate,
      zadnji_veliki_servis_km: parsed.data.trenutnaKm,
      datum_kupovine: parsed.data.datumKupovine ?? null,
      nabavna_vrijednost: parsed.data.nabavnaVrijednost ?? null,
    })
    .select("id")
    .single();

  if (vehicleInsertError || !insertedVehicle) {
    console.error("[carlytics] Neuspjelo dodavanje vozila:", vehicleInsertError?.message);
    return {
      status: "error",
      message: "Vozilo nije spremljeno. Pokušaj ponovno.",
    };
  }

  const registrationStart = parsed.data.datumKupovine ?? new Date().toISOString().slice(0, 10);

  const { error: registrationInsertError } = await client.from("registracije").insert({
    vozilo_id: insertedVehicle.id,
    registracijska_oznaka: normalizedPlate,
    datum_registracije: registrationStart,
    datum_isteka: parsed.data.datumIstekaRegistracije,
    cijena: null,
  });

  if (registrationInsertError) {
    console.error(
      "[carlytics] Neuspjelo dodavanje registracije za novo vozilo:",
      registrationInsertError.message,
    );

    const { error: rollbackError } = await client.from("vozila").delete().eq("id", insertedVehicle.id);

    if (rollbackError) {
      console.error("[carlytics] Rollback vozila nije uspio:", rollbackError.message);
    }

    return {
      status: "error",
      message: "Registracija nije spremljena pa je unos vozila poništen.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/flota");

  return {
    status: "success",
    message: `Vozilo je uspješno dodano (ID: ${insertedVehicle.id}).`,
  };
}
