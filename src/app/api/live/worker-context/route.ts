import { NextResponse } from "next/server";

import {
  getActiveWorkerVehicleContext,
  getAvailableWorkerVehicles,
} from "@/lib/fleet/worker-context-service";

import { LIVE_NO_STORE_HEADERS, requireLiveApiUser } from "@/app/api/live/_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, errorResponse } = await requireLiveApiUser([
    "admin",
    "voditelj_flote",
    "zaposlenik",
  ]);

  if (errorResponse) {
    return errorResponse;
  }

  if (!user) {
    return NextResponse.json(
      { message: "Prijava je obavezna za live sinkronizaciju." },
      { status: 401, headers: LIVE_NO_STORE_HEADERS },
    );
  }

  const [activeContext, availableVehicles] = await Promise.all([
    getActiveWorkerVehicleContext(user.employeeId),
    getAvailableWorkerVehicles(user.employeeId),
  ]);

  return NextResponse.json(
    {
      activeContext,
      availableVehicles,
    },
    { headers: LIVE_NO_STORE_HEADERS },
  );
}
