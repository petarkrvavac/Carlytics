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
import { Card } from "@/components/ui/card";
import { useIsLightTheme } from "@/lib/hooks/use-is-light-theme";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export interface FuelMonthlyPoint {
  monthKey?: string;
  monthLabel: string;
  liters: number;
  totalCost: number;
}

export interface FuelTypeAveragePoint {
  label: string;
  averagePrice: number;
  entries: number;
}

interface FuelAnalyticsChartsProps {
  monthlySeries: FuelMonthlyPoint[];
  fuelTypeAverages: FuelTypeAveragePoint[];
  showFuelTypeComparison: boolean;
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

export function FuelAnalyticsCharts({
  monthlySeries,
  fuelTypeAverages,
  showFuelTypeComparison,
}: FuelAnalyticsChartsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>("6");

  const filteredMonthlySeries = useMemo(() => {
    if (selectedPeriod === "all") {
      return monthlySeries;
    }

    const monthCount = Number(selectedPeriod);

    if (!Number.isInteger(monthCount) || monthCount <= 0) {
      return monthlySeries;
    }

    return monthlySeries.slice(Math.max(0, monthlySeries.length - monthCount));
  }, [monthlySeries, selectedPeriod]);

  const isLightTheme = useIsLightTheme();

  const palette = useMemo(() => {
    if (isLightTheme) {
      return {
        text: "#334155",
        grid: "rgba(100,116,139,0.2)",
        liters: "#0284c7",
        cost: "#f59e0b",
        compare: "#059669",
      };
    }

    return {
      text: "#94a3b8",
      grid: "rgba(148,163,184,0.2)",
      liters: "#22d3ee",
      cost: "#fbbf24",
      compare: "#34d399",
    };
  }, [isLightTheme]);

  const litersAndCostData: ChartData<"bar"> = {
    labels: filteredMonthlySeries.map((entry) => entry.monthLabel),
    datasets: [
      {
        label: "Litara",
        data: filteredMonthlySeries.map((entry) => entry.liters),
        backgroundColor: palette.liters,
        yAxisID: "yLiters",
        borderRadius: 6,
      },
      {
        label: "Trošak (EUR)",
        data: filteredMonthlySeries.map((entry) => entry.totalCost),
        backgroundColor: palette.cost,
        yAxisID: "yCost",
        borderRadius: 6,
      },
    ],
  };

  const litersAndCostOptions: ChartOptions<"bar"> = {
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
            if (context.dataset.label?.includes("Litara")) {
              return `${value.toLocaleString("hr-HR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} L`;
            }

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
      yLiters: {
        position: "left",
        grid: {
          color: palette.grid,
        },
        ticks: {
          color: palette.text,
        },
      },
      yCost: {
        position: "right",
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          color: palette.text,
        },
      },
    },
  };

  const avgPriceData: ChartData<"bar"> = {
    labels: fuelTypeAverages.map((entry) => entry.label),
    datasets: [
      {
        label: "Prosjek EUR/L",
        data: fuelTypeAverages.map((entry) => entry.averagePrice),
        backgroundColor: palette.compare,
        borderRadius: 8,
      },
    ],
  };

  const avgPriceOptions: ChartOptions<"bar"> = {
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
            })} EUR/L`;
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

  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
            Litraža i trošak
          </h2>
          <div className="flex items-center gap-2">
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
            <Badge variant="info">{getPeriodLabel(selectedPeriod)}</Badge>
          </div>
        </div>

        {filteredMonthlySeries.length === 0 ? (
          <p className="text-sm text-muted">Nema dovoljno unosa za prikaz trenda litraže i troška.</p>
        ) : (
          <div className="h-72 rounded-xl border border-border bg-surface-elevated p-2.5">
            <Bar data={litersAndCostData} options={litersAndCostOptions} />
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
            Benzin vs dizel
          </h2>
        </div>

        {!showFuelTypeComparison ? (
          <p className="text-sm text-muted">
            Usporedba prosječne cijene benzina i dizela je skrivena kada je odabrano jedno vozilo.
          </p>
        ) : fuelTypeAverages.length === 0 ? (
          <p className="text-sm text-muted">Nema dovoljno podataka za usporedbu prosječne cijene po tipu goriva.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {fuelTypeAverages.map((entry) => (
                <Badge key={entry.label} variant="neutral">
                  {entry.label}: {entry.averagePrice.toLocaleString("hr-HR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} EUR/L
                </Badge>
              ))}
            </div>
            <div className="mt-3 h-60 rounded-xl border border-border bg-surface-elevated p-2.5">
              <Bar data={avgPriceData} options={avgPriceOptions} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
