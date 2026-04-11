"use client";

import { useMemo, useState } from "react";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";

import { Badge } from "@/components/ui/badge";
import { useIsLightTheme } from "@/lib/hooks/use-is-light-theme";
import type { EmployeeMonthlyKmPoint } from "@/lib/employees/employee-service";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface EmployeeKmChartProps {
  series: EmployeeMonthlyKmPoint[];
}

type PeriodFilter = "3" | "6" | "12" | "all";

function getPeriodLabel(period: PeriodFilter) {
  if (period === "3") {
    return "Zadnja 3 mj.";
  }

  if (period === "6") {
    return "Zadnjih 6 mj.";
  }

  if (period === "12") {
    return "Zadnjih 12 mj.";
  }

  return "Sve";
}

export function EmployeeKmChart({ series }: EmployeeKmChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>("6");

  const filteredSeries = useMemo(() => {
    if (selectedPeriod === "all") {
      return series;
    }

    const monthCount = Number(selectedPeriod);

    if (!Number.isInteger(monthCount) || monthCount <= 0) {
      return series;
    }

    return series.slice(Math.max(0, series.length - monthCount));
  }, [selectedPeriod, series]);

  const isLightTheme = useIsLightTheme();

  const palette = useMemo(() => {
    if (isLightTheme) {
      return {
        text: "#334155",
        grid: "rgba(100,116,139,0.2)",
        bar: "#0284c7",
      };
    }

    return {
      text: "#94a3b8",
      grid: "rgba(148,163,184,0.2)",
      bar: "#22d3ee",
    };
  }, [isLightTheme]);

  const data: ChartData<"bar"> = {
    labels: filteredSeries.map((entry) => entry.monthLabel),
    datasets: [
      {
        label: "Prijeđeni km",
        data: filteredSeries.map((entry) => entry.km),
        backgroundColor: palette.bar,
        borderRadius: 6,
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
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
            return `${value.toLocaleString("hr-HR")} km`;
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

  if (series.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted">
        Nema dovoljno podataka za prikaz kilometraže.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <select
          value={selectedPeriod}
          onChange={(event) => setSelectedPeriod(event.target.value as PeriodFilter)}
          className="carlytics-select h-8 rounded-lg px-2 text-xs"
        >
          <option value="3">Zadnja 3 mj.</option>
          <option value="6">Zadnjih 6 mj.</option>
          <option value="12">Zadnjih 12 mj.</option>
          <option value="all">Sve</option>
        </select>
        <Badge variant="neutral">{getPeriodLabel(selectedPeriod)}</Badge>
      </div>

      {filteredSeries.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted">
          Nema podataka za odabrani period.
        </div>
      ) : (
        <div className="h-64 rounded-xl border border-border bg-surface-elevated p-2.5">
          <Bar data={data} options={options} />
        </div>
      )}
    </div>
  );
}
