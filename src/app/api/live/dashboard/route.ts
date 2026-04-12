import { NextResponse } from "next/server";

import { getDashboardData } from "@/lib/fleet/dashboard-service";
import { getOperationsOverviewData } from "@/lib/fleet/operations-service";

import { LIVE_NO_STORE_HEADERS, requireLiveApiUser } from "@/app/api/live/_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const { errorResponse } = await requireLiveApiUser(["admin", "voditelj_flote"]);

  if (errorResponse) {
    return errorResponse;
  }

  const [dashboardData, operationsData] = await Promise.all([
    getDashboardData(),
    getOperationsOverviewData(),
  ]);

  return NextResponse.json(
    {
      dashboardData,
      operationsData,
    },
    { headers: LIVE_NO_STORE_HEADERS },
  );
}
