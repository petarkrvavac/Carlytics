import { compare } from "bcryptjs";
import { verify as verifyArgon2 } from "argon2";

import { mapRoleNameToAppRole, type AppRole } from "@/lib/auth/roles";
import { createOptionalServerSupabaseClient } from "@/lib/supabase/server";
import { createOptionalServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type { Tables } from "@/types/database";

interface AuthenticatedEmployee {
  employeeId: number;
  username: string;
  fullName: string;
  role: AppRole;
}

type EmployeeRow = Tables<"zaposlenici">;

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

async function isPasswordValid(input: string, storedPassword: string) {
  if (storedPassword.startsWith("$argon2")) {
    try {
      return await verifyArgon2(storedPassword, input);
    } catch {
      return false;
    }
  }

  if (storedPassword.startsWith("$2")) {
    return compare(input, storedPassword);
  }

  return input === storedPassword;
}

async function findEmployeeByUsername(username: string) {
  const client =
    createOptionalServiceRoleSupabaseClient() ?? createOptionalServerSupabaseClient();

  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from("zaposlenici")
    .select("*")
    .eq("korisnicko_ime", username)
    .maybeSingle();

  if (error) {
    console.error("[carlytics] Neuspjelo čitanje zaposlenika:", error.message);
    return null;
  }

  return data as EmployeeRow | null;
}

async function resolveEmployeeRole(ulogaId: number | null) {
  const client =
    createOptionalServiceRoleSupabaseClient() ?? createOptionalServerSupabaseClient();

  if (!client || !ulogaId) {
    return "zaposlenik" as const;
  }

  const { data, error } = await client
    .from("uloge")
    .select("naziv")
    .eq("id", ulogaId)
    .maybeSingle();

  if (error) {
    console.error("[carlytics] Neuspjelo čitanje uloge:", error.message);
    return "zaposlenik" as const;
  }

  return mapRoleNameToAppRole(data?.naziv);
}

export async function authenticateEmployeeByCredentials(
  username: string,
  password: string,
): Promise<AuthenticatedEmployee | null> {
  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername || !password) {
    return null;
  }

  const employee = await findEmployeeByUsername(normalizedUsername);

  if (!employee) {
    return null;
  }

  if (employee.is_aktivan === false) {
    return null;
  }

  const isValidPassword = await isPasswordValid(password, employee.lozinka);

  if (!isValidPassword) {
    return null;
  }

  const role = await resolveEmployeeRole(employee.uloga_id);

  return {
    employeeId: employee.id,
    username: employee.korisnicko_ime,
    fullName: `${employee.ime} ${employee.prezime}`.trim(),
    role,
  };
}
