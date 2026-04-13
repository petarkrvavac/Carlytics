"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

interface FuelVehicleOption {
  id: number;
  label: string;
  plate: string;
}

interface FuelSectionFiltersProps {
  selectedVehicleId: number | null;
  vehicleOptions: FuelVehicleOption[];
}

export function FuelSectionFilters({
  selectedVehicleId,
  vehicleOptions,
}: FuelSectionFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentVehicleValue =
    searchParams.get("vozilo") ?? (selectedVehicleId ? String(selectedVehicleId) : "");

  const applyVehicleFilter = (nextVehicle: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (nextVehicle) {
      params.set("vozilo", nextVehicle);
    } else {
      params.delete("vozilo");
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
  const clearHref = clearParams.toString() ? `${pathname}?${clearParams.toString()}` : pathname;

  return (
    <div
      key={`fuel-section-filters-${currentVehicleValue}`}
      className="flex w-full min-w-0 flex-col gap-2 rounded-xl border border-border bg-surface px-2 py-1.5 sm:w-auto sm:flex-row sm:items-center"
    >
      <select
        name="vozilo"
        defaultValue={currentVehicleValue}
        onChange={(event) => {
          const nextVehicle = event.target.value;
          applyVehicleFilter(nextVehicle);
        }}
        disabled={isPending}
        className="carlytics-select h-8 w-full min-w-0 rounded-lg px-2 text-xs sm:w-60"
      >
        <option value="">Sva vozila</option>
        {vehicleOptions.map((vehicleOption) => (
          <option key={vehicleOption.id} value={vehicleOption.id}>
            {vehicleOption.label} ({vehicleOption.plate})
          </option>
        ))}
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
