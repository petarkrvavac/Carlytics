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

interface ServiceHistoryFiltersProps {
  selectedVehicleId: number | null;
  selectedPeriod: PeriodFilter;
  vehicleOptions: ServiceHistoryVehicleOption[];
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
}: ServiceHistoryFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentVehicleValue =
    searchParams.get("vozilo") ?? (selectedVehicleId ? String(selectedVehicleId) : "");
  const currentPeriod = parsePeriodFilter(searchParams.get("period"), selectedPeriod);

  const applyFilters = (nextVehicle: string, nextPeriod: PeriodFilter) => {
    const params = new URLSearchParams(searchParams.toString());

    if (nextVehicle) {
      params.set("vozilo", nextVehicle);
    } else {
      params.delete("vozilo");
    }

    params.set("period", nextPeriod);
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
  const clearHref = clearParams.toString() ? `${pathname}?${clearParams.toString()}` : pathname;

  return (
    <div
      key={`service-history-filters-${currentVehicleValue}-${currentPeriod}`}
      className="mr-1 flex w-full min-w-0 flex-col gap-2 rounded-xl border border-border bg-surface px-2 py-1.5 sm:w-auto sm:flex-row sm:items-center"
    >
      <select
        name="vozilo"
        defaultValue={currentVehicleValue}
        onChange={(event) => {
          const nextVehicle = event.target.value;
          applyFilters(nextVehicle, currentPeriod);
        }}
        disabled={isPending}
        className="carlytics-select h-8 w-full min-w-0 rounded-lg px-2 text-xs sm:w-64"
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
          applyFilters(currentVehicleValue, nextPeriod);
        }}
        disabled={isPending}
        className="carlytics-select h-8 w-full min-w-0 rounded-lg px-2 text-xs sm:w-auto"
      >
        <option value="3">Zadnja 3 mj.</option>
        <option value="6">Zadnjih 6 mj.</option>
        <option value="12">Zadnjih 12 mj.</option>
        <option value="all">Sve</option>
      </select>

      <Link
        href={clearHref}
        scroll={false}
        className="inline-flex h-8 w-full items-center justify-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200 sm:w-auto"
      >
        Očisti
      </Link>
    </div>
  );
}
