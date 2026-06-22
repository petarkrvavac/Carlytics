import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/session";
import { getOperationsOverviewData } from "@/lib/fleet/operations-service";
import { buildCsv } from "@/lib/reports/csv";

export const dynamic = "force-dynamic";

function formatCsvDecimal(value: number) {
  return value.toLocaleString("hr-HR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parsePositive(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: Request) {
  await requireSessionUser({
    allowedRoles: ["admin", "voditelj_flote"],
    redirectTo: "/prijava",
    forbiddenRedirectTo: "/m",
  });

  const url = new URL(request.url);
  const vehicleId = parsePositive(url.searchParams.get("vozilo"));
  const from = url.searchParams.get("od") ?? "";
  const to = url.searchParams.get("do") ?? "";

  const operationsData = await getOperationsOverviewData();
  const filtered = operationsData.fuelLedger.filter((entry) => {
    if (vehicleId && entry.vehicleId !== vehicleId) return false;

    const referenceDate = new Date(entry.dateIso);
    const dateKey = Number.isNaN(referenceDate.getTime())
      ? ""
      : referenceDate.toISOString().slice(0, 10);
    if (from && dateKey && dateKey < from) return false;
    if (to && dateKey && dateKey > to) return false;

    return true;
  });

  const csv = buildCsv(
    [
      "Unos ID",
      "Datum",
      "Vozilo",
      "Registracija",
      "Tip goriva",
      "Zaposlenik",
      "Kilometraza",
      "Litraza",
      "EUR/L",
      "Ukupno EUR",
    ],
    filtered.map((entry) => [
      entry.id,
      entry.dateIso,
      entry.vehicleLabel,
      entry.plate,
      entry.fuelTypeLabel ?? "N/A",
      entry.employeeName,
      entry.kmAtFill,
      formatCsvDecimal(entry.liters),
      formatCsvDecimal(entry.pricePerLiter),
      formatCsvDecimal(entry.totalAmount),
    ]),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="carlytics-gorivo.csv"',
      "Cache-Control": "no-store",
    },
  });
}
