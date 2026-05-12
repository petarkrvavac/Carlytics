"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import type { PeriodFilter } from "@/components/service-center/service-center-cost-charts";

interface ServiceHistoryVehicleOption {
  id: number;
  label: string;
  plate: string;
}

interface ServiceHistoryOption {
  id: number;
  label: string;
}

interface ServiceHistoryFiltersProps {
  selectedVehicleId: number | null;
  selectedPeriod: PeriodFilter;
  vehicleOptions: ServiceHistoryVehicleOption[];
  categoryOptions: ServiceHistoryOption[];
  selectedCategoryId: number | null;
  dateFrom: string;
  dateTo: string;
}

const PERIOD_FILTERS = new Set<PeriodFilter>(["3", "6", "12", "all"]);

function parsePeriodFilter(value: string | null, fallback: PeriodFilter): PeriodFilter {
  if (!value) {
    return fallback;
  }

  if (PERIOD_FILTERS.has(value as PeriodFilter)) {
    return value as PeriodFilter;
  }

  return fallback;
}

export function ServiceHistoryFilters({
  selectedVehicleId,
  selectedPeriod,
  vehicleOptions,
  categoryOptions,
  selectedCategoryId,
  dateFrom,
  dateTo,
}: ServiceHistoryFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentVehicleValue =
    searchParams.get("vozilo") ?? (selectedVehicleId ? String(selectedVehicleId) : "");
  const currentPeriod = parsePeriodFilter(searchParams.get("period"), selectedPeriod);
  const currentCategory = searchParams.get("kategorija") ?? (selectedCategoryId ? String(selectedCategoryId) : "");

  const applyFilterPatch = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(patch)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }

    params.delete("stranica");

    const query = params.toString();
    const nextHref = query ? `${pathname}?${query}` : pathname;

    startTransition(() => {
      router.replace(nextHref, { scroll: false });
    });
  };

  const clearParams = new URLSearchParams(searchParams.toString());
  clearParams.delete("vozilo");
  clearParams.delete("stranica");
  clearParams.delete("period");
  clearParams.delete("kategorija");
  clearParams.delete("od");
  clearParams.delete("do");
  const clearHref = clearParams.toString() ? `${pathname}?${clearParams.toString()}` : pathname;

  return (
    <div
      key={`service-history-filters-${currentVehicleValue}-${currentPeriod}-${currentCategory}-${dateFrom}-${dateTo}`}
      className="mr-1 grid w-full min-w-0 gap-2 rounded-xl border border-border bg-surface px-2 py-1.5 md:grid-cols-3 xl:grid-cols-6"
    >
      <select
        name="vozilo"
        defaultValue={currentVehicleValue}
        onChange={(event) => {
          const nextVehicle = event.target.value;
          applyFilterPatch({ vozilo: nextVehicle || null });
        }}
        disabled={isPending}
        className="carlytics-select h-8 w-full min-w-0 rounded-lg px-2 text-xs"
      >
        <option value="">Sva vozila</option>
        {vehicleOptions.map((vehicleOption) => (
          <option key={vehicleOption.id} value={vehicleOption.id}>
            {vehicleOption.label} ({vehicleOption.plate})
          </option>
        ))}
      </select>

      <select
        name="period"
        defaultValue={currentPeriod}
        onChange={(event) => {
          const nextPeriod = parsePeriodFilter(event.target.value, selectedPeriod);
          applyFilterPatch({ period: nextPeriod });
        }}
        disabled={isPending}
        className="carlytics-select h-8 w-full min-w-0 rounded-lg px-2 text-xs"
      >
        <option value="3">Zadnja 3 mj.</option>
        <option value="6">Zadnjih 6 mj.</option>
        <option value="12">Zadnjih 12 mj.</option>
        <option value="all">Sve</option>
      </select>

      <select
        name="kategorija"
        defaultValue={currentCategory}
        disabled={isPending}
        onChange={(event) => applyFilterPatch({ kategorija: event.target.value || null })}
        className="carlytics-select h-8 w-full min-w-0 rounded-lg px-2 text-xs"
      >
        <option value="">Sve kategorije</option>
        {categoryOptions.map((category) => (
          <option key={category.id} value={category.id}>
            {category.label}
          </option>
        ))}
      </select>

      <input
        type="date"
        defaultValue={dateFrom}
        onChange={(event) => applyFilterPatch({ od: event.target.value || null })}
        className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-cyan-500/45"
      />

      <input
        type="date"
        defaultValue={dateTo}
        onChange={(event) => applyFilterPatch({ do: event.target.value || null })}
        className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-cyan-500/45"
      />

      <Link
        href={clearHref}
        scroll={false}
        className="inline-flex h-8 w-full items-center justify-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200"
      >
        Očisti
      </Link>
    </div>
  );
}
