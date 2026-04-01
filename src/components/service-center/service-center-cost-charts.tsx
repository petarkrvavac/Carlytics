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

type PeriodFilter = "3" | "6" | "12" | "all";

interface ServiceCenterCostChartsProps {
  serviceTimeline: ServiceTimelineItem[];
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

function getMonthsForPeriod(period: PeriodFilter) {
  if (period === "all") {
    return [];
  }

  const monthCount = Number(period);
  const now = new Date();
  const keys: string[] = [];

  for (let index = monthCount - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    keys.push(toMonthKey(date));
  }

  return keys;
}

export function ServiceCenterCostCharts({ serviceTimeline }: ServiceCenterCostChartsProps) {
  const isLightTheme = useIsLightTheme();
  const [selectedCategory, setSelectedCategory] = useState("sve");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>("6");

  const completedServices = useMemo(() => {
    return serviceTimeline.filter((service) => !service.isOpen && service.cost > 0);
  }, [serviceTimeline]);

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
    const periodMonthKeys = getMonthsForPeriod(selectedPeriod);
    const isAllPeriod = selectedPeriod === "all";
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

      if (!isAllPeriod && !periodMonthKeys.includes(monthKey)) {
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
  }, [completedServices, effectiveSelectedCategory, selectedPeriod]);

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
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
            Udio troška po kategoriji
          </h3>
          <Badge variant="info">Završenih servisa: {completedServices.length}</Badge>
        </div>

        <div className="h-80 rounded-xl border border-border bg-surface-elevated p-3">
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

            <select
              value={selectedPeriod}
              onChange={(event) => setSelectedPeriod(event.target.value as PeriodFilter)}
              className="carlytics-select h-9 rounded-lg px-3 text-xs"
            >
              <option value="3">Zadnja 3 mj.</option>
              <option value="6">Zadnjih 6 mj.</option>
              <option value="12">Zadnjih 12 mj.</option>
              <option value="all">Sve</option>
            </select>
          </div>
        </div>

        <div className="h-80 rounded-xl border border-border bg-surface-elevated p-3">
          <Line data={lineData} options={lineOptions} />
        </div>
      </Card>
    </div>
  );
}
