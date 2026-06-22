"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Plus, Search, SlidersHorizontal, X } from "lucide-react";

import {
  AddVehicleForm,
  type AddVehicleFormSuccessPayload,
} from "@/components/fleet/add-vehicle-form";
import { VehicleStatusCard } from "@/components/fleet/vehicle-status-card";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageHeader } from "@/components/ui/page-header";
import { isVehicleServiceUrgent } from "@/lib/fleet/service-due";
import type { VehicleListItem } from "@/lib/fleet/types";
import type { VehicleFormContext } from "@/lib/fleet/vehicle-form-context-service";
import { useLiveSourceRefresh } from "@/lib/hooks/use-live-source-refresh";
import { cn } from "@/lib/utils/cn";
import { replaceCurrentUrlQueryParams } from "@/lib/utils/url-query";

const ITEMS_PER_PAGE = 12;
const LIVE_FLEET_SOURCE_TABLES = [
  "evidencija_goriva",
  "servisne_intervencije",
  "zaduzenja",
  "vozila",
  "registracije",
];

export type FleetStatusFilter = "sve" | "slobodno" | "zauzeto" | "servis" | "neaktivna";
export type FleetRiskFilter = "sve" | "servis" | "registracija" | "kvar";

interface FleetSectionContentProps {
  vehicles: VehicleListItem[];
  formContext: VehicleFormContext;
  initialFilter: FleetStatusFilter;
  initialSearchQuery: string;
  initialManufacturerId: number | null;
  initialModelId: number | null;
  initialRiskFilter: FleetRiskFilter;
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

const RISK_FILTERS: Array<{ key: FleetRiskFilter; label: string }> = [
  { key: "sve", label: "Svi rizici" },
  { key: "servis", label: "Servis" },
  { key: "registracija", label: "Registracija" },
  { key: "kvar", label: "Kvar" },
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
  manufacturerId: number | null,
  modelId: number | null,
  riskFilter: FleetRiskFilter,
) {
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const applyCommonFilters = (vehicle: VehicleListItem) => {
    if (!matchesVehicleSearch(vehicle, normalizedSearchQuery)) {
      return false;
    }

    if (manufacturerId && vehicle.manufacturerId !== manufacturerId) {
      return false;
    }

    if (modelId && vehicle.modelId !== modelId) {
      return false;
    }

    if (riskFilter === "servis") {
      return isVehicleServiceUrgent(vehicle);
    }

    if (riskFilter === "registracija") {
      return vehicle.registrationExpiryDays !== null && vehicle.registrationExpiryDays <= 30;
    }

    if (riskFilter === "kvar") {
      return vehicle.openFaultCount > 0;
    }

    return true;
  };

  if (filter === "neaktivna") {
    return vehicles.filter((vehicle) => !vehicle.isActive && applyCommonFilters(vehicle));
  }

  const activeVehicles = vehicles.filter((vehicle) => vehicle.isActive);

  if (filter === "slobodno") {
    return activeVehicles.filter(
      (vehicle) => vehicle.status === "Slobodno" && applyCommonFilters(vehicle),
    );
  }

  if (filter === "zauzeto") {
    return activeVehicles.filter(
      (vehicle) => vehicle.status === "Zauzeto" && applyCommonFilters(vehicle),
    );
  }

  if (filter === "servis") {
    return activeVehicles.filter(
      (vehicle) =>
        (vehicle.openFaultCount > 0 || vehicle.status === "Na servisu") && applyCommonFilters(vehicle),
    );
  }

  return activeVehicles.filter((vehicle) => applyCommonFilters(vehicle));
}

export function FleetSectionContent({
  vehicles,
  formContext,
  initialFilter,
  initialSearchQuery,
  initialManufacturerId,
  initialModelId,
  initialRiskFilter,
}: FleetSectionContentProps) {
  const [fleetVehicles, setFleetVehicles] = useState(vehicles);
  const [activeFilter, setActiveFilter] = useState<FleetStatusFilter>(initialFilter);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [manufacturerId, setManufacturerId] = useState<number | null>(initialManufacturerId);
  const [modelId, setModelId] = useState<number | null>(initialModelId);
  const [riskFilter, setRiskFilter] = useState<FleetRiskFilter>(initialRiskFilter);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const syncFiltersToUrl = useCallback((next: {
    status?: FleetStatusFilter;
    q?: string;
    manufacturerId?: number | null;
    modelId?: number | null;
    risk?: FleetRiskFilter;
  }) => {
    const resolvedStatus = next.status ?? activeFilter;
    const resolvedSearch = next.q ?? searchQuery;
    const resolvedManufacturerId =
      Object.prototype.hasOwnProperty.call(next, "manufacturerId")
        ? next.manufacturerId
        : manufacturerId;
    const resolvedModelId =
      Object.prototype.hasOwnProperty.call(next, "modelId") ? next.modelId : modelId;
    const resolvedRisk = next.risk ?? riskFilter;

    replaceCurrentUrlQueryParams({
      status: resolvedStatus === "sve" ? null : resolvedStatus,
      q: resolvedSearch.trim() || null,
      proizvodjac: resolvedManufacturerId ? String(resolvedManufacturerId) : null,
      model: resolvedModelId ? String(resolvedModelId) : null,
      rizik: resolvedRisk === "sve" ? null : resolvedRisk,
    });
  }, [activeFilter, manufacturerId, modelId, riskFilter, searchQuery]);

  const refreshFleetSnapshot = useCallback(async () => {
    const response = await fetch("/api/live/fleet", {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { vehicles?: VehicleListItem[] };

    if (!Array.isArray(payload.vehicles)) {
      return;
    }

    setFleetVehicles(payload.vehicles);
  }, []);

  useLiveSourceRefresh({
    sourceTables: LIVE_FLEET_SOURCE_TABLES,
    onRefresh: refreshFleetSnapshot,
  });

  useEffect(() => {
    setFleetVehicles(vehicles);
  }, [vehicles]);

  const visibleVehicles = useMemo(
    () =>
      getFilteredVehicles(
        fleetVehicles,
        activeFilter,
        searchQuery,
        manufacturerId,
        modelId,
        riskFilter,
      ),
    [activeFilter, fleetVehicles, manufacturerId, modelId, riskFilter, searchQuery],
  );
  const fleetReportHref = useMemo(() => {
    const params = new URLSearchParams();

    if (activeFilter !== "sve") params.set("status", activeFilter);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (manufacturerId) params.set("proizvodjac", String(manufacturerId));
    if (modelId) params.set("model", String(modelId));
    if (riskFilter !== "sve") params.set("rizik", riskFilter);

    const query = params.toString();
    return query ? `/api/reports/fleet.csv?${query}` : "/api/reports/fleet.csv";
  }, [activeFilter, manufacturerId, modelId, riskFilter, searchQuery]);

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

  const handleFormSuccess = useCallback((payload: AddVehicleFormSuccessPayload | null) => {
    if (payload?.vehicle) {
      const createdVehicle = payload.vehicle;

      setFleetVehicles((current) => [
        createdVehicle,
        ...current.filter((vehicle) => vehicle.id !== createdVehicle.id),
      ]);
      setCurrentPage(1);
    }

    setIsModalOpen(false);
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Flota"
        description="Pregled svih vozila, servisnog rizika i operativnog statusa s fokusom na brzu akciju."
        actions={
          <div className="flex flex-wrap gap-2">
            <a
              href={fleetReportHref}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200"
            >
              <Download size={15} />
              CSV
            </a>
            <button
              type="button"
              onClick={openModal}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-cyan-300 bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              <Plus size={15} />
              Dodaj vozilo
            </button>
          </div>
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
                const nextQuery = event.target.value;
                setSearchQuery(nextQuery);
                setCurrentPage(1);
                syncFiltersToUrl({ q: nextQuery });
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
                syncFiltersToUrl({ status: filter.key });
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

        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <select
            value={manufacturerId ?? ""}
            onChange={(event) => {
              const nextManufacturerId = event.target.value ? Number(event.target.value) : null;
              setManufacturerId(nextManufacturerId);
              setModelId(null);
              setCurrentPage(1);
              syncFiltersToUrl({ manufacturerId: nextManufacturerId, modelId: null });
            }}
            className="carlytics-select h-9 rounded-lg px-3 text-xs"
          >
            <option value="">Svi proizvođači</option>
            {formContext.manufacturerOptions.map((manufacturer) => (
              <option key={manufacturer.id} value={manufacturer.id}>
                {manufacturer.label}
              </option>
            ))}
          </select>

          <select
            value={modelId ?? ""}
            onChange={(event) => {
              const nextModelId = event.target.value ? Number(event.target.value) : null;
              setModelId(nextModelId);
              setCurrentPage(1);
              syncFiltersToUrl({ modelId: nextModelId });
            }}
            className="carlytics-select h-9 rounded-lg px-3 text-xs"
          >
            <option value="">Svi modeli</option>
            {formContext.modelOptions
              .filter((model) => !manufacturerId || model.manufacturerId === manufacturerId)
              .map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
          </select>

          <select
            value={riskFilter}
            onChange={(event) => {
              const nextRisk = event.target.value as FleetRiskFilter;
              setRiskFilter(nextRisk);
              setCurrentPage(1);
              syncFiltersToUrl({ risk: nextRisk });
            }}
            className="carlytics-select h-9 rounded-lg px-3 text-xs"
          >
            {RISK_FILTERS.map((filter) => (
              <option key={filter.key} value={filter.key}>
                {filter.label}
              </option>
            ))}
          </select>
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
          <div className="grid gap-4 md:auto-rows-fr md:grid-cols-2 lg:grid-cols-3">
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
        <div className="fixed inset-0 z-50 p-0 sm:p-6">
          <button
            type="button"
            onClick={closeModal}
            aria-label="Zatvori modal dodavanja vozila"
            className="absolute inset-0 bg-slate-950/55"
          />

          <div className="relative mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-none border border-border bg-background sm:h-[min(96vh,920px)] sm:rounded-2xl">
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

            <div className="min-h-0 flex-1 p-2 sm:p-4">
              <AddVehicleForm
                modelOptions={formContext.modelOptions}
                statusOptions={formContext.statusOptions}
                manufacturerOptions={formContext.manufacturerOptions}
                fuelTypeOptions={formContext.fuelTypeOptions}
                placeOptions={formContext.placeOptions}
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
