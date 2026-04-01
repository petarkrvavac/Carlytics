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

import { Badge } from "@/components/ui/badge";
import { useIsLightTheme } from "@/lib/hooks/use-is-light-theme";
import type { VehicleCostBreakdownPoint } from "@/lib/fleet/vehicle-digital-twin-service";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface VehicleCostBreakdownChartProps {
  series: VehicleCostBreakdownPoint[];
}

export function VehicleCostBreakdownChart({ series }: VehicleCostBreakdownChartProps) {
  const isLightTheme = useIsLightTheme();

  const palette = useMemo(() => {
    if (isLightTheme) {
      return {
        text: "#334155",
        grid: "rgba(100, 116, 139, 0.22)",
        fuel: "#0284c7",
        tires: "#7c3aed",
        regular: "#059669",
        extraordinary: "#ea580c",
      };
    }

    return {
      text: "#94a3b8",
      grid: "rgba(148, 163, 184, 0.22)",
      fuel: "#22d3ee",
      tires: "#a78bfa",
      regular: "#34d399",
      extraordinary: "#fb923c",
    };
  }, [isLightTheme]);

  const totals = useMemo(() => {
    return series.reduce(
      (acc, point) => {
        acc.fuel += point.fuelCost;
        acc.tires += point.tireCost;
        acc.regular += point.regularServiceCost;
        acc.extraordinary += point.extraordinaryServiceCost;
        return acc;
      },
      {
        fuel: 0,
        tires: 0,
        regular: 0,
        extraordinary: 0,
      },
    );
  }, [series]);

  const chartData: ChartData<"bar"> = {
    labels: series.map((point) => point.monthLabel),
    datasets: [
      {
        label: "Gorivo",
        data: series.map((point) => point.fuelCost),
        backgroundColor: palette.fuel,
        borderRadius: 6,
      },
      {
        label: "Gume",
        data: series.map((point) => point.tireCost),
        backgroundColor: palette.tires,
        borderRadius: 6,
      },
      {
        label: "Redovni servis",
        data: series.map((point) => point.regularServiceCost),
        backgroundColor: palette.regular,
        borderRadius: 6,
      },
      {
        label: "Izvanredni servis",
        data: series.map((point) => point.extraordinaryServiceCost),
        backgroundColor: palette.extraordinary,
        borderRadius: 6,
      },
    ],
  };

  const chartOptions: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: palette.text,
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
        },
      },
      tooltip: {
        callbacks: {
          label(context) {
            const value = Number(context.raw ?? 0);
            return `${context.dataset.label ?? "Trošak"}: ${value.toLocaleString("hr-HR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} EUR`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: {
          color: palette.grid,
        },
        ticks: {
          color: palette.text,
        },
      },
      y: {
        stacked: true,
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
        Nema dovoljno podataka za graf troškova po vozilu.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="info">Gorivo {totals.fuel.toLocaleString("hr-HR")} EUR</Badge>
        <Badge variant="neutral">Gume {totals.tires.toLocaleString("hr-HR")} EUR</Badge>
        <Badge variant="success">Redovni {totals.regular.toLocaleString("hr-HR")} EUR</Badge>
        <Badge variant="warning">Izvanredni {totals.extraordinary.toLocaleString("hr-HR")} EUR</Badge>
      </div>

      <div className="h-72 rounded-xl border border-border bg-surface-elevated p-2.5">
        <Bar data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}
