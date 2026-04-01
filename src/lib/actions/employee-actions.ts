"use server";

import { randomBytes } from "node:crypto";

import { argon2id, hash as hashArgon2 } from "argon2";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/lib/actions/action-state";
import { requireSessionUser } from "@/lib/auth/session";
import {
  buildEmployeeInvitePath,
  getEmployeeInviteExpiryIso,
  getInviteTargetByToken,
  getInviteTokenStatus,
} from "@/lib/employees/invitation-service";
import { createOptionalServerSupabaseClient } from "@/lib/supabase/server";
import { createOptionalServiceRoleSupabaseClient } from "@/lib/supabase/service-role";

const USERNAME_PATTERN = /^[a-z0-9._-]+$/;

const ARGON2_OPTIONS = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const createEmployeeInviteSchema = z.object({
  ime: z.string().trim().min(2, "Ime mora imati barem 2 znaka."),
  prezime: z.string().trim().min(2, "Prezime mora imati barem 2 znaka."),
  email: z.string().trim().email("Unesi valjan email."),
  ulogaId: z.coerce.number().int().positive("Uloga je obavezna."),
  mjestoId: z.coerce.number().int().positive("Mjesto je obavezno."),
});

const updateEmployeeActivationSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  isAktivan: z.enum(["true", "false"]),
  razlogDeaktivacije: z.preprocess((value) => {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value).trim();
  }, z.string()),
});

const setPasswordFromTokenSchema = z
  .object({
    token: z.string().trim().min(10, "Token pozivnice je neispravan."),
    korisnickoIme: z
      .string()
      .trim()
      .min(3, "Korisničko ime mora imati barem 3 znaka.")
      .max(40, "Korisničko ime može imati najviše 40 znakova.")
      .regex(
        USERNAME_PATTERN,
        "Korisničko ime smije sadržavati samo mala slova, brojeve i znakove . _ -",
      ),
    lozinka: z.string().min(8, "Lozinka mora imati barem 8 znakova."),
    potvrdaLozinke: z.string().min(1, "Potvrda lozinke je obavezna."),
  })
  .refine((value) => value.lozinka === value.potvrdaLozinke, {
    message: "Lozinke se ne podudaraju.",
    path: ["potvrdaLozinke"],
  });

interface EmployeeInviteActionState extends ActionState {
  inviteLink?: string;
}

function getDbClient() {
  return createOptionalServiceRoleSupabaseClient() ?? createOptionalServerSupabaseClient();
}

function normalizeDisplayValue(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function generateInviteToken() {
  return randomBytes(32).toString("hex");
}

function generateTemporaryUsername() {
  return `pozivnica_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

function generateTemporaryPassword() {
  return randomBytes(18).toString("hex");
}

async function resolveUniqueTemporaryUsername(
  client: NonNullable<ReturnType<typeof getDbClient>>,
) {
  let attempts = 0;

  while (attempts < 8) {
    attempts += 1;
    const candidate = generateTemporaryUsername();

    const { data, error } = await client
      .from("zaposlenici")
      .select("id")
      .eq("korisnicko_ime", candidate)
      .maybeSingle();

    if (error) {
      console.error("[carlytics] Neuspješna provjera privremenog korisničkog imena:", error.message);
      return null;
    }

    if (!data) {
      return candidate;
    }
  }

  return null;
}

export async function createEmployeeInviteAction(
  _previousState: EmployeeInviteActionState,
  formData: FormData,
): Promise<EmployeeInviteActionState> {
  const parsed = createEmployeeInviteSchema.safeParse({
    ime: formData.get("ime"),
    prezime: formData.get("prezime"),
    email: formData.get("email"),
    ulogaId: formData.get("ulogaId"),
    mjestoId: formData.get("mjestoId"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Provjeri unesene podatke.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      inviteLink: "",
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
      message: "Supabase nije konfiguriran. Zaposlenik nije dodan.",
      inviteLink: "",
    };
  }

  const normalizedEmail = normalizeEmail(parsed.data.email);

  const { data: existingEmployeeByEmail, error: existingEmailError } = await client
    .from("zaposlenici")
    .select("id")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (existingEmailError) {
    console.error("[carlytics] Neuspješna provjera postojećeg emaila:", existingEmailError.message);
    return {
      status: "error",
      message: "Trenutno nije moguće provjeriti email. Pokušaj ponovno.",
      inviteLink: "",
    };
  }

  if (existingEmployeeByEmail) {
    return {
      status: "error",
      message: "Zaposlenik s tim emailom već postoji.",
      fieldErrors: {
        email: ["Email je već zauzet."],
      },
      inviteLink: "",
    };
  }

  const temporaryUsername = await resolveUniqueTemporaryUsername(client);

  if (!temporaryUsername) {
    return {
      status: "error",
      message: "Nije moguće generirati privremeno korisničko ime. Pokušaj ponovno.",
      inviteLink: "",
    };
  }

  const inviteToken = generateInviteToken();
  const inviteExpiryIso = getEmployeeInviteExpiryIso();

  let temporaryPasswordHash: string;

  try {
    temporaryPasswordHash = await hashArgon2(generateTemporaryPassword(), ARGON2_OPTIONS);
  } catch (error) {
    console.error("[carlytics] Neuspjelo hashiranje privremene lozinke:", error);
    return {
      status: "error",
      message: "Nije moguće pripremiti pozivnicu. Pokušaj ponovno.",
      inviteLink: "",
    };
  }

  const { error: insertError } = await client.from("zaposlenici").insert({
    ime: normalizeDisplayValue(parsed.data.ime),
    prezime: normalizeDisplayValue(parsed.data.prezime),
    email: normalizedEmail,
    uloga_id: parsed.data.ulogaId,
    mjesto_id: parsed.data.mjestoId,
    korisnicko_ime: temporaryUsername,
    lozinka: temporaryPasswordHash,
    is_aktivan: true,
    pozivnica_token: inviteToken,
    pozivnica_vrijedi_do: inviteExpiryIso,
  });

  if (insertError) {
    console.error("[carlytics] Neuspjelo dodavanje zaposlenika:", {
      code: insertError.code,
      message: insertError.message,
    });

    return {
      status: "error",
      message: "Zaposlenik nije dodan. Pokušaj ponovno.",
      inviteLink: "",
    };
  }

  const inviteLink = buildEmployeeInvitePath(inviteToken);

  revalidatePath("/zaposlenici");

  return {
    status: "success",
    message: "Zaposlenik je dodan i pozivnica je generirana.",
    inviteLink,
  };
}

export async function updateEmployeeActivationAction(formData: FormData) {
  const parsed = updateEmployeeActivationSchema.safeParse({
    employeeId: formData.get("employeeId"),
    isAktivan: formData.get("isAktivan"),
    razlogDeaktivacije: formData.get("razlogDeaktivacije"),
  });

  if (!parsed.success) {
    console.warn("[carlytics] Neispravan payload za updateEmployeeActivationAction:", parsed.error.flatten().fieldErrors);
    return;
  }

  await requireSessionUser({
    allowedRoles: ["admin", "voditelj_flote"],
    redirectTo: "/prijava",
    forbiddenRedirectTo: "/m",
  });

  const client = getDbClient();

  if (!client) {
    console.error("[carlytics] Supabase nije konfiguriran za updateEmployeeActivationAction.");
    return;
  }

  const nextIsActive = parsed.data.isAktivan === "true";
  const deactivationReason = parsed.data.razlogDeaktivacije;

  if (!nextIsActive && deactivationReason.length < 3) {
    console.warn("[carlytics] Deaktivacija zaposlenika odbijena: razlog je prekratak.");
    return;
  }

  const updatePayload: {
    is_aktivan: boolean;
    pozivnica_token?: string | null;
    pozivnica_vrijedi_do?: string | null;
    razlog_deaktivacije?: string | null;
  } = {
    is_aktivan: nextIsActive,
  };

  if (!nextIsActive) {
    updatePayload.pozivnica_token = null;
    updatePayload.pozivnica_vrijedi_do = null;
    updatePayload.razlog_deaktivacije = deactivationReason;
  } else {
    updatePayload.razlog_deaktivacije = null;
  }

  const { error } = await client
    .from("zaposlenici")
    .update(updatePayload)
    .eq("id", parsed.data.employeeId);

  if (error) {
    console.error("[carlytics] Neuspjelo ažuriranje statusa zaposlenika:", error.message);
    return;
  }

  revalidatePath("/zaposlenici");
}

export async function submitSetPasswordFromTokenAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = setPasswordFromTokenSchema.safeParse({
    token: formData.get("token"),
    korisnickoIme: formData.get("korisnickoIme"),
    lozinka: formData.get("lozinka"),
    potvrdaLozinke: formData.get("potvrdaLozinke"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Provjeri unesene podatke.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const token = parsed.data.token.trim();
  const tokenStatus = await getInviteTokenStatus(token);

  if (!tokenStatus.isValid) {
    return {
      status: "error",
      message: tokenStatus.message,
    };
  }

  const inviteTarget = await getInviteTargetByToken(token);

  if (!inviteTarget) {
    return {
      status: "error",
      message: "Pozivnica više nije dostupna. Zatraži novu pozivnicu.",
    };
  }

  const normalizedUsername = normalizeUsername(parsed.data.korisnickoIme);
  const client = getDbClient();

  if (!client) {
    return {
      status: "error",
      message: "Supabase nije konfiguriran. Postava lozinke nije moguća.",
    };
  }

  const { data: usernameTaken, error: usernameCheckError } = await client
    .from("zaposlenici")
    .select("id")
    .ilike("korisnicko_ime", normalizedUsername)
    .neq("id", inviteTarget.employeeId)
    .maybeSingle();

  if (usernameCheckError) {
    console.error("[carlytics] Neuspješna provjera korisničkog imena:", usernameCheckError.message);
    return {
      status: "error",
      message: "Trenutno nije moguće provjeriti korisničko ime. Pokušaj ponovno.",
    };
  }

  if (usernameTaken) {
    return {
      status: "error",
      message: "Odabrano korisničko ime je zauzeto.",
      fieldErrors: {
        korisnickoIme: ["Korisničko ime je zauzeto."],
      },
    };
  }

  let passwordHash: string;

  try {
    passwordHash = await hashArgon2(parsed.data.lozinka, ARGON2_OPTIONS);
  } catch (error) {
    console.error("[carlytics] Neuspjelo hashiranje korisničke lozinke:", error);
    return {
      status: "error",
      message: "Lozinku trenutačno nije moguće spremiti. Pokušaj ponovno.",
    };
  }

  const { data: updatedEmployee, error: updateError } = await client
    .from("zaposlenici")
    .update({
      korisnicko_ime: normalizedUsername,
      lozinka: passwordHash,
      is_aktivan: true,
      pozivnica_token: null,
      pozivnica_vrijedi_do: null,
    })
    .eq("id", inviteTarget.employeeId)
    .eq("pozivnica_token", token)
    .select("id")
    .maybeSingle();

  if (updateError || !updatedEmployee) {
    console.error("[carlytics] Neuspjela finalizacija postave lozinke:", updateError?.message);
    return {
      status: "error",
      message: "Pozivnica više nije valjana. Zatraži novu pozivnicu.",
    };
  }

  revalidatePath("/zaposlenici");
  revalidatePath("/prijava");

  redirect("/prijava");
}
