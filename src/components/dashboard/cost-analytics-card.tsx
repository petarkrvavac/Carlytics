"use client";

import { useEffect, useState } from "react";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import type { CostSeriesPoint } from "@/lib/fleet/types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

export type CostCompareMode = "standard" | "ukupno" | "razlika";

interface CostAnalyticsCardProps {
  series: CostSeriesPoint[];
  mode?: CostCompareMode;
  isUsingFallbackData?: boolean;
}

interface ChartPalette {
  text: string;
  grid: string;
  zeroLine: string;
  fuel: string;
  service: string;
  total: string;
  delta: string;
  fillFuel: string;
  fillService: string;
  fillTotal: string;
  fillDelta: string;
}

function getChartDomain(values: number[], includeZero = false) {
  if (values.length === 0) {
    return { min: 0, max: 1 };
  }

  let min = Math.min(...values);
  let max = Math.max(...values);

  if (includeZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }

  if (min === max) {
    const fallbackPadding = Math.max(1, Math.abs(min) * 0.1);
    min -= fallbackPadding;
    max += fallbackPadding;
  }

  const padding = (max - min) * 0.12;
  return {
    min: min - padding,
    max: max + padding,
  };
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("hr-HR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.round(value));
}

function resolveChartPalette(isLightTheme: boolean): ChartPalette {
  if (isLightTheme) {
    return {
      text: "#334155",
      grid: "rgba(100, 116, 139, 0.25)",
      zeroLine: "rgba(30, 41, 59, 0.38)",
      fuel: "#0284c7",
      service: "#d97706",
      total: "#0369a1",
      delta: "#dc2626",
      fillFuel: "rgba(2, 132, 199, 0.18)",
      fillService: "rgba(217, 119, 6, 0.14)",
      fillTotal: "rgba(3, 105, 161, 0.18)",
      fillDelta: "rgba(220, 38, 38, 0.14)",
    };
  }

  return {
    text: "#94a3b8",
    grid: "rgba(148, 163, 184, 0.22)",
    zeroLine: "rgba(148, 163, 184, 0.5)",
    fuel: "#22d3ee",
    service: "#f59e0b",
    total: "#60a5fa",
    delta: "#fb7185",
    fillFuel: "rgba(34, 211, 238, 0.2)",
    fillService: "rgba(245, 158, 11, 0.14)",
    fillTotal: "rgba(96, 165, 250, 0.2)",
    fillDelta: "rgba(251, 113, 133, 0.14)",
  };
}

function getTicksStep(values: number[]) {
  const maxAbs = Math.max(...values.map((value) => Math.abs(value)), 1);

  if (maxAbs >= 100000) {
    return 20000;
  }

  if (maxAbs >= 50000) {
    return 10000;
  }

  if (maxAbs >= 20000) {
    return 5000;
  }

  if (maxAbs >= 10000) {
    return 2000;
  }

  if (maxAbs >= 5000) {
    return 1000;
  }

  if (maxAbs >= 1000) {
    return 500;
  }

  return 100;
}

export function CostAnalyticsCard({
  series,
  mode = "standard",
  isUsingFallbackData = false,
}: CostAnalyticsCardProps) {
  const [isLightTheme, setIsLightTheme] = useState(false);

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = () => {
      setIsLightTheme(root.classList.contains("light"));
    };

    applyTheme();

    const observer = new MutationObserver(applyTheme);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const palette = resolveChartPalette(isLightTheme);

  const fuelValues = series.map((entry) => entry.fuelCost);
  const serviceValues = series.map((entry) => entry.serviceCost);
  const totalValues = series.map((entry) => entry.fuelCost + entry.serviceCost);
  const deltaValues = series.map((entry) => entry.serviceCost - entry.fuelCost);

  const totalFuel = fuelValues.reduce((sum, value) => sum + value, 0);
  const totalService = serviceValues.reduce((sum, value) => sum + value, 0);
  const totalCombined = totalValues.reduce((sum, value) => sum + value, 0);
  const deltaCombined = deltaValues.reduce((sum, value) => sum + value, 0);

  const standardDomain = getChartDomain([...fuelValues, ...serviceValues]);
  const totalDomain = getChartDomain(totalValues);
  const deltaDomain = getChartDomain(deltaValues, true);

  const domain =
    mode === "ukupno"
      ? totalDomain
      : mode === "razlika"
        ? deltaDomain
        : standardDomain;

  const labels = series.map((entry) => entry.monthLabel);

  const chartData: ChartData<"line"> =
    mode === "ukupno"
      ? {
          labels,
          datasets: [
            {
              label: "Ukupni trošak",
              data: totalValues,
              borderColor: palette.total,
              backgroundColor: palette.fillTotal,
              fill: true,
              borderWidth: 3,
              pointRadius: 3,
              pointHoverRadius: 5,
              pointBackgroundColor: palette.total,
              pointBorderColor: "#ffffff",
              pointBorderWidth: 2,
              tension: 0.35,
            },
          ],
        }
      : mode === "razlika"
        ? {
            labels,
            datasets: [
              {
                label: "Razlika servis - gorivo",
                data: deltaValues,
                borderColor: palette.delta,
                backgroundColor: palette.fillDelta,
                fill: true,
                borderWidth: 3,
                pointRadius: 3,
                pointHoverRadius: 5,
                pointBackgroundColor: palette.delta,
                pointBorderColor: "#ffffff",
                pointBorderWidth: 2,
                tension: 0.35,
              },
            ],
          }
        : {
            labels,
            datasets: [
              {
                label: "Gorivo",
                data: fuelValues,
                borderColor: palette.fuel,
                backgroundColor: palette.fillFuel,
                fill: true,
                borderWidth: 3,
                pointRadius: 2.5,
                pointHoverRadius: 4,
                pointBackgroundColor: palette.fuel,
                pointBorderColor: "#ffffff",
                pointBorderWidth: 1.5,
                tension: 0.35,
              },
              {
                label: "Servis",
                data: serviceValues,
                borderColor: palette.service,
                backgroundColor: palette.fillService,
                fill: true,
                borderWidth: 3,
                pointRadius: 2.5,
                pointHoverRadius: 4,
                pointBackgroundColor: palette.service,
                pointBorderColor: "#ffffff",
                pointBorderWidth: 1.5,
                tension: 0.35,
              },
            ],
          };

  const valuesForTicks =
    mode === "ukupno"
      ? totalValues
      : mode === "razlika"
        ? deltaValues
        : [...fuelValues, ...serviceValues];

  const stepSize = getTicksStep(valuesForTicks);

  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        labels: {
          color: palette.text,
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          pointStyle: "circle",
        },
      },
      tooltip: {
        callbacks: {
          label(context) {
            const raw = Number(context.raw ?? 0);
            return `${context.dataset.label ?? "Vrijednost"}: ${raw.toLocaleString("hr-HR")} EUR`;
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
        min: domain.min,
        max: domain.max,
        ticks: {
          color: palette.text,
          stepSize,
          callback(value) {
            return formatCompactCurrency(Number(value));
          },
        },
        grid: {
          color(context) {
            if (mode === "razlika" && Number(context.tick.value) === 0) {
              return palette.zeroLine;
            }

            return palette.grid;
          },
          lineWidth(context) {
            if (mode === "razlika" && Number(context.tick.value) === 0) {
              return 1.4;
            }

            return 1;
          },
        },
      },
    },
  };

  const modeDescription =
    mode === "ukupno"
      ? "Trend ukupnog mjesečnog troška (gorivo + servis)."
      : mode === "razlika"
        ? "Mjesečna razlika servis - gorivo. Pozitivna vrijednost znači skuplji servis."
        : "Usporedba troška goriva i servisa kroz zadnjih 6 mjeseci.";

  return (
    <Card className="p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Analitika troškova</CardTitle>
          <CardDescription className="mt-1">{modeDescription}</CardDescription>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {mode === "ukupno" ? (
            <Badge variant="info">Ukupno {totalCombined.toLocaleString("hr-HR")} EUR</Badge>
          ) : mode === "razlika" ? (
            <Badge variant={deltaCombined >= 0 ? "warning" : "info"}>
              Δ {deltaCombined.toLocaleString("hr-HR")} EUR
            </Badge>
          ) : (
            <>
              <Badge variant="info">Gorivo {totalFuel.toLocaleString("hr-HR")} EUR</Badge>
              <Badge variant="warning">Servis {totalService.toLocaleString("hr-HR")} EUR</Badge>
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface-elevated p-2.5">
        {series.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted">
            Trenutačno nema dovoljno podataka za prikaz trenda troškova.
          </div>
        ) : (
          <>
            {isUsingFallbackData ? (
              <div className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-200">
                Prikazani su demo podaci. Graf će se automatski prebaciti na stvarne vrijednosti kada je baza dostupna.
              </div>
            ) : null}

            <div className={isUsingFallbackData ? "mt-2.5 h-48" : "h-48"}>
              <Line data={chartData} options={chartOptions} />
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
