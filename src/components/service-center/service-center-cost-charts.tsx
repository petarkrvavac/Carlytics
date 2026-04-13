"use client";

import { useMemo, useState } from "react";
import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Line, Pie } from "react-chartjs-2";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { isRegularServiceCategoryLabel } from "@/lib/fleet/intervention-category";
import type { ServiceTimelineItem } from "@/lib/fleet/operations-service";
import { useIsLightTheme } from "@/lib/hooks/use-is-light-theme";

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
);

export type PeriodFilter = "3" | "6" | "12" | "all";

interface ServiceCenterCostChartsProps {
  serviceTimeline: ServiceTimelineItem[];
  showTopVehicles?: boolean;
  initialPeriod?: PeriodFilter;
}

interface TopVehicleLeaderboardItem {
  key: string;
  vehicleId: number | null;
  label: string;
  plate: string;
  totalCost: number;
  serviceCount: number;
  averageCost: number;
  regularCount: number;
  extraordinaryCount: number;
  regularCost: number;
  extraordinaryCost: number;
  regularSharePercent: number;
  extraordinarySharePercent: number;
  extraordinaryServiceSharePercent: number;
}

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

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toMonthKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

function toMonthLabel(monthKey: string) {
  const [yearPart, monthPart] = monthKey.split("-");
  const monthIndex = Number(monthPart) - 1;

  if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return monthKey;
  }

  const shortYear = yearPart?.slice(-2) ?? "";
  return `${HR_MONTH_LABELS[monthIndex]} '${shortYear}`;
}

function getMonthsForPeriod(period: PeriodFilter, offsetPeriods = 0) {
  if (period === "all") {
    return [];
  }

  const monthCount = Number(period);
  const now = new Date();
  const keys: string[] = [];

  for (let index = monthCount - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - (offsetPeriods * monthCount + index), 1);
    keys.push(toMonthKey(date));
  }

  return keys;
}

function getPeriodLabel(period: PeriodFilter) {
  if (period === "3") {
    return "Zadnja 3 mjeseca";
  }

  if (period === "6") {
    return "Zadnjih 6 mjeseci";
  }

  if (period === "12") {
    return "Zadnjih 12 mjeseci";
  }

  return "Sve vrijeme";
}

function formatCurrency(value: number) {
  return value.toLocaleString("hr-HR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getRankBadgeClass(index: number) {
  if (index === 0) {
    return "border-cyan-300 bg-cyan-100 text-cyan-900 dark:border-cyan-500/35 dark:bg-cyan-500/18 dark:text-cyan-200";
  }

  if (index === 1) {
    return "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-500/18 dark:text-emerald-200";
  }

  if (index === 2) {
    return "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-500/35 dark:bg-amber-500/18 dark:text-amber-200";
  }

  return "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-800/65 dark:text-slate-200";
}

export function ServiceCenterCostCharts({
  serviceTimeline,
  showTopVehicles = true,
  initialPeriod = "6",
}: ServiceCenterCostChartsProps) {
  const isLightTheme = useIsLightTheme();

  const [selectedCategory, setSelectedCategory] = useState("sve");
  const selectedPeriod = initialPeriod;

  const completedServices = useMemo(() => {
    return serviceTimeline.filter((service) => !service.isOpen && service.cost > 0);
  }, [serviceTimeline]);

  const currentPeriodMonthKeys = useMemo(() => getMonthsForPeriod(selectedPeriod), [selectedPeriod]);

  const categoryOptions = useMemo(() => {
    const labels = new Set<string>();

    for (const service of completedServices) {
      labels.add(service.categoryLabel ?? "Nekategorizirano");
    }

    return ["sve", ...Array.from(labels).sort((left, right) => left.localeCompare(right, "hr"))];
  }, [completedServices]);
  const effectiveSelectedCategory = categoryOptions.includes(selectedCategory)
    ? selectedCategory
    : "sve";

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();

    for (const service of completedServices) {
      const category = service.categoryLabel ?? "Nekategorizirano";
      const current = totals.get(category) ?? 0;
      totals.set(category, current + service.cost);
    }

    return Array.from(totals.entries())
      .map(([label, total]) => ({ label, total: Number(total.toFixed(2)) }))
      .sort((left, right) => right.total - left.total);
  }, [completedServices]);

  const monthlySeries = useMemo(() => {
    const periodMonthKeys = currentPeriodMonthKeys;
    const isAllPeriod = selectedPeriod === "all";
    const periodMonthSet = new Set(periodMonthKeys);
    const totalsByMonth = new Map<string, number>();

    for (const service of completedServices) {
      if (
        effectiveSelectedCategory !== "sve" &&
        (service.categoryLabel ?? "Nekategorizirano") !== effectiveSelectedCategory
      ) {
        continue;
      }

      const date = parseDate(service.endedAtIso ?? service.startedAtIso);

      if (!date) {
        continue;
      }

      const monthKey = toMonthKey(date);

      if (!isAllPeriod && !periodMonthSet.has(monthKey)) {
        continue;
      }

      const current = totalsByMonth.get(monthKey) ?? 0;
      totalsByMonth.set(monthKey, current + service.cost);
    }

    const orderedMonthKeys = isAllPeriod
      ? Array.from(totalsByMonth.keys()).sort((left, right) => left.localeCompare(right))
      : periodMonthKeys;

    return orderedMonthKeys.map((monthKey) => ({
      monthKey,
      monthLabel: toMonthLabel(monthKey),
      total: Number((totalsByMonth.get(monthKey) ?? 0).toFixed(2)),
    }));
  }, [completedServices, currentPeriodMonthKeys, effectiveSelectedCategory, selectedPeriod]);

  const topVehicleLeaderboard = useMemo<TopVehicleLeaderboardItem[]>(() => {
    const periodMonthSet = new Set(currentPeriodMonthKeys);
    const isAllPeriod = selectedPeriod === "all";
    const aggregatesByVehicle = new Map<
      string,
      {
        key: string;
        vehicleId: number | null;
        label: string;
        plate: string;
        totalCost: number;
        serviceCount: number;
        regularCount: number;
        extraordinaryCount: number;
        regularCost: number;
        extraordinaryCost: number;
      }
    >();

    for (const service of completedServices) {
      const date = parseDate(service.endedAtIso ?? service.startedAtIso);

      if (!date) {
        continue;
      }

      const monthKey = toMonthKey(date);
      const aggregationKey = service.vehicleId
        ? `v-${service.vehicleId}`
        : `${service.vehicleLabel}|${service.plate}`;

      if (!isAllPeriod && !periodMonthSet.has(monthKey)) {
        continue;
      }

      const isRegular = isRegularServiceCategoryLabel(service.categoryLabel);

      const previous = aggregatesByVehicle.get(aggregationKey) ?? {
        key: aggregationKey,
        vehicleId: service.vehicleId ?? null,
        label: service.vehicleLabel,
        plate: service.plate,
        totalCost: 0,
        serviceCount: 0,
        regularCount: 0,
        extraordinaryCount: 0,
        regularCost: 0,
        extraordinaryCost: 0,
      };

      previous.totalCost += service.cost;
      previous.serviceCount += 1;

      if (isRegular) {
        previous.regularCount += 1;
        previous.regularCost += service.cost;
      } else {
        previous.extraordinaryCount += 1;
        previous.extraordinaryCost += service.cost;
      }

      aggregatesByVehicle.set(aggregationKey, previous);
    }

    return Array.from(aggregatesByVehicle.values())
      .map<TopVehicleLeaderboardItem>((item) => {
        const totalCost = Number(item.totalCost.toFixed(2));
        const regularCost = Number(item.regularCost.toFixed(2));
        const extraordinaryCost = Number(item.extraordinaryCost.toFixed(2));

        return {
          key: item.key,
          vehicleId: item.vehicleId,
          label: item.label,
          plate: item.plate,
          totalCost,
          serviceCount: item.serviceCount,
          averageCost: Number((item.serviceCount > 0 ? totalCost / item.serviceCount : 0).toFixed(2)),
          regularCount: item.regularCount,
          extraordinaryCount: item.extraordinaryCount,
          regularCost,
          extraordinaryCost,
          regularSharePercent:
            item.serviceCount > 0 ? Number(((item.regularCount / item.serviceCount) * 100).toFixed(1)) : 0,
          extraordinarySharePercent:
            item.serviceCount > 0
              ? Number(((item.extraordinaryCount / item.serviceCount) * 100).toFixed(1))
              : 0,
          extraordinaryServiceSharePercent:
            item.serviceCount > 0
              ? Number(((item.extraordinaryCount / item.serviceCount) * 100).toFixed(1))
              : 0,
        };
      })
      .sort((left, right) => right.totalCost - left.totalCost)
      .slice(0, 5);
  }, [completedServices, currentPeriodMonthKeys, selectedPeriod]);

  const palette = useMemo(() => {
    if (isLightTheme) {
      return {
        text: "#334155",
        grid: "rgba(100,116,139,0.2)",
        line: "#0ea5e9",
        pieBorder: "#f8fafc",
        pie: [
          "#0057B8",
          "#D7263D",
          "#008148",
          "#FF7F11",
          "#6A1B9A",
          "#2E4057",
          "#00A6A6",
          "#A663CC",
          "#9E2A2B",
          "#FFB703",
        ],
      };
    }

    return {
      text: "#94a3b8",
      grid: "rgba(148,163,184,0.2)",
      line: "#22d3ee",
      pieBorder: "#0f172a",
      pie: [
        "#66B3FF",
        "#FF6B6B",
        "#5EE6A8",
        "#FFC15E",
        "#C792EA",
        "#A7B4C8",
        "#5CE1E6",
        "#F39CFF",
        "#FF8C8C",
        "#FFE066",
      ],
    };
  }, [isLightTheme]);

  const pieData: ChartData<"pie"> = {
    labels: categoryTotals.map((entry) => entry.label),
    datasets: [
      {
        data: categoryTotals.map((entry) => entry.total),
        backgroundColor: categoryTotals.map((_, index) => palette.pie[index % palette.pie.length]),
        borderColor: palette.pieBorder,
        borderWidth: 2,
        hoverOffset: 10,
        spacing: 2,
      },
    ],
  };

  const pieOptions: ChartOptions<"pie"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: palette.text,
          usePointStyle: true,
        },
      },
      tooltip: {
        callbacks: {
          label(context) {
            const value = Number(context.raw ?? 0);
            return `${context.label}: ${value.toLocaleString("hr-HR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} EUR`;
          },
        },
      },
    },
  };

  const lineData: ChartData<"line"> = {
    labels: monthlySeries.map((entry) => entry.monthLabel),
    datasets: [
      {
        label:
          effectiveSelectedCategory === "sve"
            ? "Ukupni trošak"
            : `Trošak: ${effectiveSelectedCategory}`,
        data: monthlySeries.map((entry) => entry.total),
        borderColor: palette.line,
        backgroundColor: "rgba(34,211,238,0.2)",
        fill: true,
        tension: 0.32,
        pointRadius: 3,
      },
    ],
  };

  const lineOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: palette.text,
          usePointStyle: true,
        },
      },
      tooltip: {
        callbacks: {
          label(context) {
            const value = Number(context.raw ?? 0);
            return `${value.toLocaleString("hr-HR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} EUR`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: palette.grid,
        },
        ticks: {
          color: palette.text,
        },
      },
      y: {
        grid: {
          color: palette.grid,
        },
        ticks: {
          color: palette.text,
        },
      },
    },
  };

  if (completedServices.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">Nema završenih servisa s troškom za prikaz analitike.</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
            Udio troška po kategoriji
          </h3>
          <Badge variant="info">Završenih servisa: {completedServices.length}</Badge>
        </div>

        <div className="h-64 rounded-xl border border-border bg-surface-elevated p-3 sm:h-80">
          <Pie data={pieData} options={pieOptions} />
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
            Trend troška
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={effectiveSelectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="carlytics-select h-9 rounded-lg px-3 text-xs"
            >
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category === "sve" ? "Sve kategorije" : category}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="h-64 rounded-xl border border-border bg-surface-elevated p-3 sm:h-80">
          <Line data={lineData} options={lineOptions} />
        </div>
      </Card>

      {showTopVehicles ? (
        <Card className="md:col-span-2 xl:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
              Top 5 najskupljih vozila
            </h3>
            <Badge variant="info">Period: {getPeriodLabel(selectedPeriod)}</Badge>
          </div>

          {topVehicleLeaderboard.length === 0 ? (
            <p className="text-sm text-muted">Nema završenih servisa s troškom u odabranom periodu.</p>
          ) : (
            <ol className="space-y-2">
              {topVehicleLeaderboard.map((vehicleCost, index) => {
                const regularWidth = Math.max(0, Math.min(100, vehicleCost.regularSharePercent));
                const extraordinaryWidth = Math.max(0, Math.min(100, vehicleCost.extraordinarySharePercent));

                return (
                <li
                  key={vehicleCost.key}
                  className="section-transition rounded-xl border border-border bg-surface-elevated px-3 py-3 transition-all duration-300 hover:border-cyan-500/40"
                  style={{ animationDelay: `${index * 45}ms` }}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <Badge className={`h-6 px-2 text-[10px] font-semibold ${getRankBadgeClass(index)}`}>
                      #{index + 1}
                    </Badge>
                    <div className="min-w-0 sm:min-w-52">
                      <p className="truncate text-sm font-semibold text-foreground">{vehicleCost.label}</p>
                      <p className="text-xs text-muted">{vehicleCost.plate}</p>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
                        <span>Redovni: {vehicleCost.regularCount}</span>
                        <span>Izvanredni: {vehicleCost.extraordinaryCount}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full border border-border/60 bg-slate-200/40 dark:bg-slate-800/65">
                        <div className="flex h-full w-full">
                          <div
                            className="h-full bg-emerald-400 transition-all duration-300"
                            style={{ width: `${regularWidth}%` }}
                          />
                          <div
                            className="h-full bg-amber-400 transition-all duration-300"
                            style={{ width: `${extraordinaryWidth}%` }}
                          />
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                        <span>Servisa: {vehicleCost.serviceCount}</span>
                        <span>Prosjek: {formatCurrency(vehicleCost.averageCost)} EUR</span>
                        <span>Izvanredni udio: {vehicleCost.extraordinaryServiceSharePercent.toFixed(1)}%</span>
                      </div>
                    </div>

                    <div className="ml-auto flex min-w-36 flex-col items-end gap-1 text-right">
                      <p className="data-font text-sm font-semibold text-amber-200">
                        {formatCurrency(vehicleCost.totalCost)}
                        <span className="ml-1 text-xs text-amber-300">EUR</span>
                      </p>
                    </div>
                  </div>
                </li>
                );
              })}
            </ol>
          )}
        </Card>
      ) : null}
    </div>
  );
}
