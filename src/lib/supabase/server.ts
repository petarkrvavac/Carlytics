import { createClient } from "@supabase/supabase-js";

import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/types/database";

export function createServerSupabaseClient() {
  const { url, anonKey } = getSupabaseEnv();

  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function createOptionalServerSupabaseClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  return createServerSupabaseClient();
}
