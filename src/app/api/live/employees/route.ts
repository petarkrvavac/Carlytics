import { NextResponse } from "next/server";

import { LIVE_NO_STORE_HEADERS, requireLiveApiUser } from "@/app/api/live/_shared";
import { getEmployeesOverviewData } from "@/lib/employees/employee-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const { errorResponse } = await requireLiveApiUser(["admin", "voditelj_flote"]);

  if (errorResponse) {
    return errorResponse;
  }

  const overviewData = await getEmployeesOverviewData();

  return NextResponse.json(
    {
      overviewData,
    },
    { headers: LIVE_NO_STORE_HEADERS },
  );
}
