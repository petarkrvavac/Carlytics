import { NextResponse } from "next/server";

import { getOperationsOverviewData } from "@/lib/fleet/operations-service";

import { LIVE_NO_STORE_HEADERS, requireLiveApiUser } from "@/app/api/live/_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const { errorResponse } = await requireLiveApiUser(["admin", "voditelj_flote"]);

  if (errorResponse) {
    return errorResponse;
  }

  const operationsData = await getOperationsOverviewData();

  return NextResponse.json(
    {
      operationsData,
    },
    { headers: LIVE_NO_STORE_HEADERS },
  );
}
