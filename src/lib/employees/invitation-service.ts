import { createOptionalServerSupabaseClient } from "@/lib/supabase/server";
import { createOptionalServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type { Tables } from "@/types/database";

const INVITATION_EXPIRY_HOURS = 24;
const INVITATION_EXPIRY_MS = INVITATION_EXPIRY_HOURS * 60 * 60 * 1000;
const INVITE_BASE_URL = "http://localhost:3000";

type InviteRow = Pick<Tables<"zaposlenici">, "id" | "pozivnica_token" | "pozivnica_vrijedi_do">;

export interface InviteTokenStatus {
  isValid: boolean;
  message: string;
  expiresAtIso: string | null;
}

export interface InviteTarget {
  employeeId: number;
  expiresAtIso: string | null;
}

function getDbClient() {
  return createOptionalServiceRoleSupabaseClient() ?? createOptionalServerSupabaseClient();
}

function normalizeToken(token: string) {
  return token.trim();
}

function parseIsoDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

async function fetchInviteRowByToken(token: string): Promise<InviteRow | null> {
  const client = getDbClient();

  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from("zaposlenici")
    .select("id, pozivnica_token, pozivnica_vrijedi_do")
    .eq("pozivnica_token", token)
    .maybeSingle();

  if (error) {
    console.error("[carlytics] Neuspješno čitanje pozivnice:", error.message);
    return null;
  }

  return (data as InviteRow | null) ?? null;
}

export function buildEmployeeInvitePath(token: string) {
  const invitePath = `/postavi-lozinku?token=${encodeURIComponent(token)}`;
  return new URL(invitePath, INVITE_BASE_URL).toString();
}

export function getEmployeeInviteExpiryIso() {
  return new Date(Date.now() + INVITATION_EXPIRY_MS).toISOString();
}

export async function getInviteTargetByToken(tokenInput: string): Promise<InviteTarget | null> {
  const token = normalizeToken(tokenInput);

  if (!token) {
    return null;
  }

  const inviteRow = await fetchInviteRowByToken(token);

  if (!inviteRow) {
    return null;
  }

  return {
    employeeId: inviteRow.id,
    expiresAtIso: inviteRow.pozivnica_vrijedi_do,
  };
}

export async function getInviteTokenStatus(tokenInput: string): Promise<InviteTokenStatus> {
  const token = normalizeToken(tokenInput);

  if (!token) {
    return {
      isValid: false,
      message: "Nedostaje token pozivnice.",
      expiresAtIso: null,
    };
  }

  const inviteRow = await fetchInviteRowByToken(token);

  if (!inviteRow) {
    return {
      isValid: false,
      message: "Pozivnica nije pronađena ili je već iskorištena.",
      expiresAtIso: null,
    };
  }

  const expiryDate = parseIsoDate(inviteRow.pozivnica_vrijedi_do);

  if (!expiryDate || expiryDate.getTime() <= Date.now()) {
    return {
      isValid: false,
      message: "Pozivnica je istekla. Zatraži novu pozivnicu od administratora.",
      expiresAtIso: inviteRow.pozivnica_vrijedi_do,
    };
  }

  return {
    isValid: true,
    message: "Pozivnica je valjana.",
    expiresAtIso: inviteRow.pozivnica_vrijedi_do,
  };
}
