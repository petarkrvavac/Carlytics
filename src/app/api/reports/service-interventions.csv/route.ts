import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/session";
import { getServiceCenterTimelineData } from "@/lib/fleet/operations-service";
import type { PeriodFilter } from "@/components/service-center/service-center-cost-charts";
import { buildCsv } from "@/lib/reports/csv";

export const dynamic = "force-dynamic";

function parsePositive(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parsePeriod(value: string | null): PeriodFilter {
  if (value === "3" || value === "6" || value === "12" || value === "all") {
    return value;
  }

  return "6";
}

function getPeriodStartDate(period: PeriodFilter) {
  if (period === "all") {
    return null;
  }

  const monthCount = Number(period);
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - (monthCount - 1), 1);
}

export async function GET(request: Request) {
  await requireSessionUser({
    allowedRoles: ["admin", "voditelj_flote"],
    redirectTo: "/prijava",
    forbiddenRedirectTo: "/m",
  });

  const url = new URL(request.url);
  const vehicleId = parsePositive(url.searchParams.get("vozilo"));
  const categoryId = parsePositive(url.searchParams.get("kategorija"));
  const period = parsePeriod(url.searchParams.get("period"));
  const from = url.searchParams.get("od") ?? "";
  const to = url.searchParams.get("do") ?? "";
  const periodStart = getPeriodStartDate(period);

  const timelineData = await getServiceCenterTimelineData();
  const filtered = timelineData.serviceTimeline.filter((service) => {
    if (vehicleId && service.vehicleId !== vehicleId) return false;
    if (categoryId && service.categoryId !== categoryId) return false;
    if (service.isOpen) return false;

    const referenceDate = new Date(service.endedAtIso ?? service.startedAtIso);
    const dateKey = Number.isNaN(referenceDate.getTime()) ? "" : referenceDate.toISOString().slice(0, 10);
    if (periodStart && referenceDate.getTime() < periodStart.getTime()) return false;
    if (from && dateKey && dateKey < from) return false;
    if (to && dateKey && dateKey > to) return false;

    return true;
  });

  const csv = buildCsv(
    [
      "Intervencija ID",
      "Vozilo",
      "Registracija",
      "Opis",
      "Kategorija",
      "Hitnost",
      "Status",
      "Pocetak",
      "Zavrsetak",
      "Kilometraza",
      "Cijena EUR",
      "Zaposlenik",
    ],
    filtered.map((service) => [
      service.id,
      service.vehicleLabel,
      service.plate,
      service.description,
      service.categoryLabel ?? "Nekategorizirano",
      service.priority ?? "",
      "zatvoreno",
      service.startedAtIso,
      service.endedAtIso,
      service.kmAtMoment,
      service.cost.toFixed(2),
      service.reporterName ?? "",
    ]),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="carlytics-servisne-intervencije.csv"',
      "Cache-Control": "no-store",
    },
  });
}
