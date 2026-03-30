import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseServiceRoleEnv,
  isSupabaseServiceRoleConfigured,
} from "@/lib/env";
import type { Database } from "@/types/database";

export function createServiceRoleSupabaseClient() {
  const { url, serviceRoleKey } = getSupabaseServiceRoleEnv();

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function createOptionalServiceRoleSupabaseClient() {
  if (!isSupabaseServiceRoleConfigured()) {
    return null;
  }

  return createServiceRoleSupabaseClient();
}
