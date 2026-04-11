import Link from "next/link";

import { FallbackChip } from "@/components/dashboard/fallback-chip";
import { FuelSectionFilters } from "@/components/fuel/fuel-section-filters";
import {
  FuelAnalyticsCharts,
  type FuelMonthlyPoint,
  type FuelTypeAveragePoint,
} from "@/components/fuel/fuel-analytics-charts";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ServerPagination } from "@/components/ui/server-pagination";
import { getOperationsOverviewData } from "@/lib/fleet/operations-service";
import { formatDateTime } from "@/lib/utils/date-format";
import { parsePageParam, parsePositiveIntegerParam } from "@/lib/utils/page-params";

interface GorivoPageProps {
  searchParams?: Promise<{ vozilo?: string; stranica?: string }>;
}

const ITEMS_PER_PAGE = 10;

const HR_MONTH_LABELS = [
  "Sij",
  "Velj",
  "Ožu",
  "Tra",
  "Svi",
  "Lip",
  "Srp",
  "Kol",
  "Ruj",
  "Lis",
  "Stu",
  "Pro",
] as const;

function toMonthLabel(monthKey: string) {
  const [yearPart, monthPart] = monthKey.split("-");
  const monthIndex = Number(monthPart) - 1;

  if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return monthKey;
  }

  const shortYear = yearPart?.slice(-2) ?? "";
  return `${HR_MONTH_LABELS[monthIndex]} '${shortYear}`;
}

function buildGorivoHref(params: { vozilo?: string; stranica?: number }) {
  const query = new URLSearchParams();

  if (params.vozilo) {
    query.set("vozilo", params.vozilo);
  }

  if (params.stranica && params.stranica > 1) {
    query.set("stranica", String(params.stranica));
  }

  const queryString = query.toString();

  return queryString ? `/gorivo?${queryString}` : "/gorivo";
}

function toMonthKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

function buildFuelMonthlySeries(
  fuelLedger: Awaited<ReturnType<typeof getOperationsOverviewData>>["fuelLedger"],
): FuelMonthlyPoint[] {
  if (fuelLedger.length === 0) {
    return [];
  }

  const totalsByMonth = new Map<string, { liters: number; totalCost: number }>();
  let earliestDate: Date | null = null;

  for (const entry of fuelLedger) {
    const parsedDate = new Date(entry.dateIso);

    if (Number.isNaN(parsedDate.getTime())) {
      continue;
    }

    const key = toMonthKey(parsedDate);
    const current = totalsByMonth.get(key) ?? { liters: 0, totalCost: 0 };

    current.liters += entry.liters;
    current.totalCost += entry.totalAmount;
    totalsByMonth.set(key, current);

    if (!earliestDate || parsedDate.getTime() < earliestDate.getTime()) {
      earliestDate = parsedDate;
    }
  }

  if (!earliestDate) {
    return [];
  }

  const startDate = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthKeys: string[] = [];

  for (
    const date = new Date(startDate);
    date.getTime() <= endDate.getTime();
    date.setMonth(date.getMonth() + 1)
  ) {
    monthKeys.push(toMonthKey(date));
  }

  return monthKeys.map((monthKey) => {
    const month = totalsByMonth.get(monthKey);

    return {
      monthKey,
      monthLabel: toMonthLabel(monthKey),
      liters: Number((month?.liters ?? 0).toFixed(2)),
      totalCost: Number((month?.totalCost ?? 0).toFixed(2)),
    };
  });
}

function buildFuelTypeAverages(
  fuelLedger: Awaited<ReturnType<typeof getOperationsOverviewData>>["fuelLedger"],
): FuelTypeAveragePoint[] {
  const grouped = new Map<string, { totalPrice: number; count: number }>();

  for (const entry of fuelLedger) {
    const rawLabel = entry.fuelTypeLabel?.trim().toLowerCase() ?? "";
    let label: string | null = null;

    if (rawLabel.includes("benz")) {
      label = "Benzin";
    }

    if (rawLabel.includes("diz") || rawLabel.includes("diesel")) {
      label = "Dizel";
    }

    if (!label) {
      continue;
    }

    const current = grouped.get(label) ?? { totalPrice: 0, count: 0 };

    current.totalPrice += entry.pricePerLiter;
    current.count += 1;
    grouped.set(label, current);
  }

  return Array.from(grouped.entries())
    .map(([label, values]) => ({
      label,
      averagePrice: values.count > 0 ? Number((values.totalPrice / values.count).toFixed(3)) : 0,
      entries: values.count,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "hr"));
}

export default async function GorivoPage({ searchParams }: GorivoPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedVehicleId = parsePositiveIntegerParam(resolvedSearchParams?.vozilo);
  const currentPage = parsePageParam(resolvedSearchParams?.stranica);
  const operationsData = await getOperationsOverviewData();

  const vehicleOptions = Array.from(
    new Map(
      operationsData.fuelLedger
        .filter((entry) => entry.vehicleId)
        .map((entry) => [entry.vehicleId!, { id: entry.vehicleId!, label: entry.vehicleLabel, plate: entry.plate }]),
    ).values(),
  ).sort((left, right) => left.label.localeCompare(right.label, "hr"));

  const filteredFuelLedger = selectedVehicleId
    ? operationsData.fuelLedger.filter((entry) => entry.vehicleId === selectedVehicleId)
    : operationsData.fuelLedger;

  const totalPages = Math.max(1, Math.ceil(filteredFuelLedger.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedFuelLedger = filteredFuelLedger.slice(
    (safeCurrentPage - 1) * ITEMS_PER_PAGE,
    safeCurrentPage * ITEMS_PER_PAGE,
  );

  const pageHref = (page: number) =>
    buildGorivoHref({
      vozilo: selectedVehicleId ? String(selectedVehicleId) : undefined,
      stranica: page,
    });

  const monthlySeries = buildFuelMonthlySeries(filteredFuelLedger);
  const fuelTypeAverages = buildFuelTypeAverages(filteredFuelLedger);
  const showFuelTypeComparison = !selectedVehicleId;

  const liters30d = Number(
    filteredFuelLedger
      .reduce((sum, entry) => sum + entry.liters, 0)
      .toFixed(2),
  );
  const totalCost = Number(
    filteredFuelLedger
      .reduce((sum, entry) => sum + entry.totalAmount, 0)
      .toFixed(2),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Gorivo"
        description="Kontrola troška i analiza potrošnje goriva po vozilu i tipu goriva."
        actions={
          <>
            <FuelSectionFilters
              selectedVehicleId={selectedVehicleId}
              vehicleOptions={vehicleOptions}
            />
            <FallbackChip isUsingFallbackData={operationsData.isUsingFallbackData} />
            <Link
              href="/m/gorivo"
              className="inline-flex h-10 items-center rounded-xl border border-cyan-300 bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Unos goriva
            </Link>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Unosi</p>
          <p className="mt-3 data-font text-3xl text-cyan-200">{filteredFuelLedger.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Ukupno litara</p>
          <p className="mt-3 data-font text-3xl text-slate-100">
            {liters30d.toLocaleString("hr-HR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Ukupan trošak</p>
          <p className="mt-3 data-font text-3xl text-amber-200">
            {totalCost.toLocaleString("hr-HR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            <span className="ml-1 text-sm text-amber-300">EUR</span>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Prosjek EUR/L</p>
          <p className="mt-3 data-font text-3xl text-sky-200">
            {(filteredFuelLedger.length > 0
              ? filteredFuelLedger.reduce((sum, entry) => sum + entry.pricePerLiter, 0) /
                filteredFuelLedger.length
              : 0
            ).toLocaleString("hr-HR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </Card>
      </section>

      <FuelAnalyticsCharts
        monthlySeries={monthlySeries}
        fuelTypeAverages={fuelTypeAverages}
        showFuelTypeComparison={showFuelTypeComparison}
      />

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
            Nedavni zapisi goriva
          </h2>
          <Badge variant="info">Zapisa: {filteredFuelLedger.length}</Badge>
        </div>

        {filteredFuelLedger.length === 0 ? (
          <p className="text-sm text-muted">Nema zabilježenih unosa goriva za odabrani filter.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-[0.2em] text-muted">
                    <th className="px-2 py-2">Datum</th>
                    <th className="px-2 py-2">Vozilo</th>
                    <th className="px-2 py-2">Tip goriva</th>
                    <th className="px-2 py-2">Zaposlenik</th>
                    <th className="px-2 py-2 text-right">KM</th>
                    <th className="px-2 py-2 text-right">L</th>
                    <th className="px-2 py-2 text-right">EUR/L</th>
                    <th className="px-2 py-2 text-right">Ukupno</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedFuelLedger.map((entry) => (
                    <tr key={entry.id} className="border-b border-border/60 last:border-0">
                      <td className="px-2 py-3 text-slate-300">{formatDateTime(entry.dateIso)}</td>
                      <td className="px-2 py-3">
                        <p className="font-medium text-slate-100">{entry.vehicleLabel}</p>
                        <p className="text-xs text-muted">{entry.plate}</p>
                      </td>
                      <td className="px-2 py-3 text-slate-300">{entry.fuelTypeLabel ?? "N/A"}</td>
                      <td className="px-2 py-3 text-slate-300">{entry.employeeName}</td>
                      <td className="px-2 py-3 text-right data-font text-slate-200">
                        {entry.kmAtFill.toLocaleString("hr-HR")}
                      </td>
                      <td className="px-2 py-3 text-right data-font text-slate-200">
                        {entry.liters.toLocaleString("hr-HR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-2 py-3 text-right data-font text-slate-200">
                        {entry.pricePerLiter.toLocaleString("hr-HR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-2 py-3 text-right data-font text-amber-200">
                        {entry.totalAmount.toLocaleString("hr-HR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ServerPagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              hrefForPage={pageHref}
            />
          </>
        )}
      </Card>
    </div>
  );
}
