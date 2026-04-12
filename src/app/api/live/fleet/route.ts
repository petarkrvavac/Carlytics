import { NextResponse } from "next/server";

import { getFleetVehiclesSnapshot } from "@/lib/fleet/dashboard-service";

import { LIVE_NO_STORE_HEADERS, requireLiveApiUser } from "@/app/api/live/_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const { errorResponse } = await requireLiveApiUser(["admin", "voditelj_flote"]);

  if (errorResponse) {
    return errorResponse;
  }

  const vehicles = await getFleetVehiclesSnapshot();

  return NextResponse.json(
    {
      vehicles,
    },
    { headers: LIVE_NO_STORE_HEADERS },
  );
}
