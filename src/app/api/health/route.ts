import { NextResponse } from "next/server";

import { createOptionalServerSupabaseClient } from "@/lib/supabase/server";
import { createOptionalServiceRoleSupabaseClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const client = createOptionalServiceRoleSupabaseClient() ?? createOptionalServerSupabaseClient();

  if (!client) {
    return NextResponse.json(
      {
        ok: false,
        timestamp: new Date().toISOString(),
        error: "Supabase is not configured.",
      },
      { status: 503 },
    );
  }

  const { error } = await client.from("app_events").select("id").limit(1);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        timestamp: new Date().toISOString(),
        error: error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
  });
}
