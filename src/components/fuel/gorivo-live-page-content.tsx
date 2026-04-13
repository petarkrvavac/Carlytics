"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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
import type { OperationsOverviewData } from "@/lib/fleet/operations-service";
import { useLiveSourceRefresh } from "@/lib/hooks/use-live-source-refresh";
import { formatDateTime } from "@/lib/utils/date-format";
import { replaceCurrentUrlQueryParams } from "@/lib/utils/url-query";

interface GorivoLivePageContentProps {
  initialOperationsData: OperationsOverviewData;
  selectedVehicleId: number | null;
  currentPage: number;
}

const ITEMS_PER_PAGE = 10;
const LIVE_FUEL_SOURCE_TABLES = [
  "evidencija_goriva",
  "zaduzenja",
  "vozila",
  "servisne_intervencije",
];
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

function toMonthKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

function buildFuelMonthlySeries(
  fuelLedger: OperationsOverviewData["fuelLedger"],
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
  fuelLedger: OperationsOverviewData["fuelLedger"],
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

export function GorivoLivePageContent({
  initialOperationsData,
  selectedVehicleId,
  currentPage,
}: GorivoLivePageContentProps) {
  const [operationsData, setOperationsData] = useState(initialOperationsData);
  const [ledgerPage, setLedgerPage] = useState(currentPage);

  const refreshOperationsData = useCallback(async () => {
    const response = await fetch("/api/live/operations", {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      operationsData?: OperationsOverviewData;
    };

    if (!payload.operationsData) {
      return;
    }

    setOperationsData(payload.operationsData);
  }, []);

  useLiveSourceRefresh({
    sourceTables: LIVE_FUEL_SOURCE_TABLES,
    onRefresh: refreshOperationsData,
  });

  const vehicleOptions = useMemo(
    () =>
      Array.from(
        new Map(
          operationsData.fuelLedger
            .filter((entry) => entry.vehicleId)
            .map((entry) => [entry.vehicleId!, { id: entry.vehicleId!, label: entry.vehicleLabel, plate: entry.plate }]),
        ).values(),
      ).sort((left, right) => left.label.localeCompare(right.label, "hr")),
    [operationsData.fuelLedger],
  );

  const filteredFuelLedger = selectedVehicleId
    ? operationsData.fuelLedger.filter((entry) => entry.vehicleId === selectedVehicleId)
    : operationsData.fuelLedger;

  const totalPages = Math.max(1, Math.ceil(filteredFuelLedger.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(Math.max(ledgerPage, 1), totalPages);
  const pagedFuelLedger = filteredFuelLedger.slice(
    (safeCurrentPage - 1) * ITEMS_PER_PAGE,
    safeCurrentPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    replaceCurrentUrlQueryParams({
      vozilo: selectedVehicleId ? String(selectedVehicleId) : null,
      stranica: safeCurrentPage > 1 ? String(safeCurrentPage) : null,
    });
  }, [safeCurrentPage, selectedVehicleId]);

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
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Gorivo"
        description="Kontrola troška i analiza potrošnje goriva po vozilu i tipu goriva."
        actions={
          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:justify-end">
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
          </div>
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
            <div className="space-y-2 lg:hidden">
              {pagedFuelLedger.map((entry) => (
                <article key={`fuel-card-${entry.id}`} className="rounded-xl border border-border bg-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-100">{entry.vehicleLabel}</p>
                      <p className="text-xs text-muted">{entry.plate}</p>
                    </div>
                    <p className="text-xs text-muted">{formatDateTime(entry.dateIso)}</p>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted">
                    <p>Tip: <span className="text-slate-200">{entry.fuelTypeLabel ?? "N/A"}</span></p>
                    <p>Zaposlenik: <span className="text-slate-200">{entry.employeeName}</span></p>
                    <p>KM: <span className="data-font text-slate-200">{entry.kmAtFill.toLocaleString("hr-HR")}</span></p>
                    <p>L: <span className="data-font text-slate-200">{entry.liters.toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                    <p>EUR/L: <span className="data-font text-slate-200">{entry.pricePerLiter.toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                    <p>Ukupno: <span className="data-font text-amber-200">{entry.totalAmount.toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden max-w-full overflow-x-auto lg:block">
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
              onPageChange={setLedgerPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
