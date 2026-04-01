"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, SlidersHorizontal, X } from "lucide-react";

import { AddVehicleForm } from "@/components/fleet/add-vehicle-form";
import { VehicleStatusCard } from "@/components/fleet/vehicle-status-card";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageHeader } from "@/components/ui/page-header";
import type { VehicleListItem } from "@/lib/fleet/types";
import type { VehicleFormContext } from "@/lib/fleet/vehicle-form-context-service";
import { cn } from "@/lib/utils/cn";

const ITEMS_PER_PAGE = 10;

export type FleetStatusFilter = "sve" | "slobodno" | "zauzeto" | "servis" | "neaktivna";

interface FleetSectionContentProps {
  vehicles: VehicleListItem[];
  formContext: VehicleFormContext;
  initialFilter: FleetStatusFilter;
}

const FILTERS: Array<{
  key: FleetStatusFilter;
  label: string;
}> = [
  { key: "sve", label: "Sva vozila" },
  { key: "slobodno", label: "Slobodno" },
  { key: "zauzeto", label: "Zauzeto" },
  { key: "servis", label: "Na servisu" },
  { key: "neaktivna", label: "Neaktivna vozila" },
];

function matchesVehicleSearch(vehicle: VehicleListItem, normalizedSearchQuery: string) {
  if (!normalizedSearchQuery) {
    return true;
  }

  const searchable = [vehicle.make, vehicle.model, vehicle.plate, vehicle.vin ?? ""]
    .join(" ")
    .toLowerCase();

  return searchable.includes(normalizedSearchQuery);
}

function getFilteredVehicles(
  vehicles: VehicleListItem[],
  filter: FleetStatusFilter,
  searchQuery: string,
) {
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  if (filter === "neaktivna") {
    return vehicles.filter(
      (vehicle) => !vehicle.isActive && matchesVehicleSearch(vehicle, normalizedSearchQuery),
    );
  }

  const activeVehicles = vehicles.filter((vehicle) => vehicle.isActive);

  if (filter === "slobodno") {
    return activeVehicles.filter(
      (vehicle) =>
        vehicle.status === "Slobodno" && matchesVehicleSearch(vehicle, normalizedSearchQuery),
    );
  }

  if (filter === "zauzeto") {
    return activeVehicles.filter(
      (vehicle) =>
        vehicle.status === "Zauzeto" && matchesVehicleSearch(vehicle, normalizedSearchQuery),
    );
  }

  if (filter === "servis") {
    return activeVehicles.filter(
      (vehicle) =>
        (vehicle.openFaultCount > 0 || vehicle.status === "Na servisu") &&
        matchesVehicleSearch(vehicle, normalizedSearchQuery),
    );
  }

  return activeVehicles.filter((vehicle) => matchesVehicleSearch(vehicle, normalizedSearchQuery));
}

export function FleetSectionContent({
  vehicles,
  formContext,
  initialFilter,
}: FleetSectionContentProps) {
  const [activeFilter, setActiveFilter] = useState<FleetStatusFilter>(initialFilter);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const visibleVehicles = useMemo(
    () => getFilteredVehicles(vehicles, activeFilter, searchQuery),
    [activeFilter, searchQuery, vehicles],
  );

  const totalPages = Math.max(1, Math.ceil(visibleVehicles.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedVehicles = useMemo(
    () =>
      visibleVehicles.slice(
        (safeCurrentPage - 1) * ITEMS_PER_PAGE,
        safeCurrentPage * ITEMS_PER_PAGE,
      ),
    [safeCurrentPage, visibleVehicles],
  );

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isModalOpen]);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleFormSuccess = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Flota"
        description="Pregled svih vozila, servisnog rizika i operativnog statusa s fokusom na brzu akciju."
        actions={
          <button
            type="button"
            onClick={openModal}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-cyan-300 bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            <Plus size={15} />
            Dodaj vozilo
          </button>
        }
      />

      <Card className="p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted">
            <SlidersHorizontal size={14} />
            Filter po statusu
          </div>

          <label className="flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-muted sm:max-w-md">
            <Search size={14} className="text-muted" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Pretraži proizvođača, model, registraciju ili VIN"
              className="h-full w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
              aria-label="Pretraga vozila"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => {
                setActiveFilter(filter.key);
                setCurrentPage(1);
              }}
              className={cn(
                "inline-flex h-8 items-center rounded-lg border px-3 text-xs font-semibold uppercase tracking-[0.14em] transition",
                activeFilter === filter.key
                  ? "border-sky-300 bg-sky-100 text-sky-800 dark:border-cyan-400/60 dark:bg-cyan-400/15 dark:text-cyan-200"
                  : "border-border bg-white text-slate-700 hover:border-cyan-500/35 hover:bg-cyan-50 hover:text-cyan-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:text-cyan-200",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </Card>

      {visibleVehicles.length === 0 ? (
        <EmptyState
          title="Nema vozila za odabrani status."
          description="Promijeni filter ili odmah dodaj novo vozilo bez napuštanja trenutnog prikaza."
          actionLabel="Dodaj vozilo"
          onActionClick={openModal}
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {pagedVehicles.map((vehicle) => (
              <VehicleStatusCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>

          <PaginationControls
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 px-3 py-4 sm:p-6">
          <button
            type="button"
            onClick={closeModal}
            aria-label="Zatvori modal dodavanja vozila"
            className="absolute inset-0 bg-slate-950/55"
          />

          <div className="relative mx-auto flex h-[min(96vh,920px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-background">
            <div className="flex items-start justify-between gap-3 border-b border-border bg-surface/70 p-3 sm:p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300">Dodaj vozilo</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                  Unos novog vozila
                </h2>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:border-cyan-500/45 hover:text-cyan-200"
                aria-label="Zatvori modal"
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 p-3 sm:p-4">
              <AddVehicleForm
                modelOptions={formContext.modelOptions}
                statusOptions={formContext.statusOptions}
                manufacturerOptions={formContext.manufacturerOptions}
                fuelTypeOptions={formContext.fuelTypeOptions}
                onCancel={closeModal}
                onSuccess={handleFormSuccess}
                mode="modal"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
