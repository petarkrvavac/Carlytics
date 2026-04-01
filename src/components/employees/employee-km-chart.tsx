"use client";

import { useMemo } from "react";
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

import { useIsLightTheme } from "@/lib/hooks/use-is-light-theme";
import type { EmployeeMonthlyKmPoint } from "@/lib/employees/employee-service";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface EmployeeKmChartProps {
  series: EmployeeMonthlyKmPoint[];
}

export function EmployeeKmChart({ series }: EmployeeKmChartProps) {
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
    labels: series.map((entry) => entry.monthLabel),
    datasets: [
      {
        label: "Prijeđeni km",
        data: series.map((entry) => entry.km),
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
    <div className="h-64 rounded-xl border border-border bg-surface-elevated p-2.5">
      <Bar data={data} options={options} />
    </div>
  );
}
