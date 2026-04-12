import { NextResponse } from "next/server";

import {
  getServiceCenterHeaderData,
  getServiceCenterTimelineData,
} from "@/lib/fleet/operations-service";

import {
  LIVE_NO_STORE_HEADERS,
  parsePositiveNumberParam,
  requireLiveApiUser,
} from "@/app/api/live/_shared";

export const dynamic = "force-dynamic";

function parsePeriod(value: string | null): "3" | "6" | "12" | "all" {
  if (value === "3" || value === "6" || value === "12" || value === "all") {
    return value;
  }

  return "6";
}

export async function GET(request: Request) {
  const { errorResponse } = await requireLiveApiUser(["admin", "voditelj_flote"]);

  if (errorResponse) {
    return errorResponse;
  }

  const url = new URL(request.url);
  const selectedVehicleId = parsePositiveNumberParam(url.searchParams.get("vozilo"));
  const selectedPeriod = parsePeriod(url.searchParams.get("period"));

  const [timelineData, headerData] = await Promise.all([
    getServiceCenterTimelineData(),
    getServiceCenterHeaderData({
      vehicleId: selectedVehicleId,
      period: selectedPeriod,
    }),
  ]);

  return NextResponse.json(
    {
      timelineData,
      headerData,
    },
    { headers: LIVE_NO_STORE_HEADERS },
  );
}
