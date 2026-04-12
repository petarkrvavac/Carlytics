"use client";

import { useCallback, useMemo, useState } from "react";

import { CostAnalyticsCard } from "@/components/dashboard/cost-analytics-card";
import { FallbackChip } from "@/components/dashboard/fallback-chip";
import { FleetHealthCard } from "@/components/dashboard/fleet-health-card";
import {
  OperationsActivityFeed,
  type DashboardActivityItem,
} from "@/components/dashboard/operations-activity-feed";
import { DataFreshnessIndicator } from "@/components/layout/data-freshness-indicator";
import { VehicleStatusCard } from "@/components/fleet/vehicle-status-card";
import { PageHeader } from "@/components/ui/page-header";
import { ServerPagination } from "@/components/ui/server-pagination";
import type { DashboardData } from "@/lib/fleet/types";
import type { OperationsOverviewData } from "@/lib/fleet/operations-service";
import { resolveInterventionAlertType } from "@/lib/fleet/intervention-category";
import { useLiveSourceRefresh } from "@/lib/hooks/use-live-source-refresh";

interface DashboardLivePageContentProps {
  initialDashboardData: DashboardData;
  initialOperationsData: OperationsOverviewData;
  initialAlertsPage: number;
  initialVehiclesPage: number;
}

const ALERTS_PER_PAGE = 10;
const VEHICLES_PER_PAGE = 8;
const LIVE_DASHBOARD_SOURCE_TABLES = [
  "evidencija_goriva",
  "servisne_intervencije",
  "zaduzenja",
  "vozila",
  "registracije",
];

function getFaultSeverity(priority: string) {
  if (priority === "kriticno") {
    return "kriticno" as const;
  }

  if (priority === "visoko") {
    return "upozorenje" as const;
  }

  return "info" as const;
}

function getSeverityRank(value: DashboardActivityItem["severity"] | undefined) {
  if (value === "kriticno") {
    return 0;
  }

  if (value === "upozorenje") {
    return 1;
  }

  return 2;
}

function isFaultInProgress(statusRaw: string | null, statusLabel: string) {
  const normalized = `${statusRaw ?? ""} ${statusLabel}`.toLowerCase();

  return (
    normalized.includes("u_obradi") ||
    normalized.includes("obradi") ||
    normalized.includes("obrada") ||
    normalized.includes("in_progress") ||
    normalized.includes("in progress")
  );
}

function buildDashboardActivityItems(
  operationsData: OperationsOverviewData,
  dashboardData: DashboardData,
) {
  const items: DashboardActivityItem[] = [
    ...dashboardData.criticalAlerts
      .filter((alert) => alert.type === "registracija" || alert.type === "servis")
      .map<DashboardActivityItem>((alert) => {
        const rawVehicleId = alert.id
          .replace("registracija-", "")
          .replace("servis-", "");
        const vehicleId = Number(rawVehicleId);

        return {
          id: alert.id,
          occurredAtIso: alert.createdAtIso,
          type: alert.type as "registracija" | "servis",
          title: alert.title,
          description: alert.description,
          href:
            Number.isInteger(vehicleId) && vehicleId > 0
              ? alert.type === "registracija"
                ? `/flota/${vehicleId}`
                : `/prijava-kvara?vozilo=${vehicleId}`
              : alert.type === "registracija"
                ? "/flota"
                : "/prijava-kvara",
          severity: alert.severity,
        };
      }),
    ...operationsData.faultQueue
      .filter((fault) => fault.isOpen && !isFaultInProgress(fault.statusRaw, fault.statusLabel))
      .map<DashboardActivityItem>((fault) => ({
        id: `kvar-${fault.id}`,
        occurredAtIso: fault.reportedAtIso,
        type: resolveInterventionAlertType(fault.categoryLabel),
        title: `${fault.vehicleLabel} (${fault.plate})`,
        description: fault.description,
        href: fault.vehicleId ? `/prijava-kvara?vozilo=${fault.vehicleId}` : "/prijava-kvara",
        severity: getFaultSeverity(fault.priority),
      })),
  ];

  const dedupedById = new Map<string, DashboardActivityItem>();

  for (const item of items) {
    const existing = dedupedById.get(item.id);

    if (!existing) {
      dedupedById.set(item.id, item);
      continue;
    }

    const existingTimestamp = new Date(existing.occurredAtIso).getTime();
    const nextTimestamp = new Date(item.occurredAtIso).getTime();

    if ((Number.isNaN(existingTimestamp) ? 0 : existingTimestamp) < (Number.isNaN(nextTimestamp) ? 0 : nextTimestamp)) {
      dedupedById.set(item.id, item);
    }
  }

  return Array.from(dedupedById.values()).sort((left, right) => {
    const severityDiff = getSeverityRank(left.severity) - getSeverityRank(right.severity);

    if (severityDiff !== 0) {
      return severityDiff;
    }

    const leftMs = new Date(left.occurredAtIso).getTime();
    const rightMs = new Date(right.occurredAtIso).getTime();
    return rightMs - leftMs;
  });
}

function buildDashboardHref(params: {
  alertsPage?: number;
  vehiclesPage?: number;
}) {
  const query = new URLSearchParams();

  if (params.alertsPage && params.alertsPage > 1) {
    query.set("upozorenja", String(params.alertsPage));
  }

  if (params.vehiclesPage && params.vehiclesPage > 1) {
    query.set("nadzor", String(params.vehiclesPage));
  }

  const queryString = query.toString();
  return queryString ? `/dashboard?${queryString}` : "/dashboard";
}

export function DashboardLivePageContent({
  initialDashboardData,
  initialOperationsData,
  initialAlertsPage,
  initialVehiclesPage,
}: DashboardLivePageContentProps) {
  const [dashboardData, setDashboardData] = useState(initialDashboardData);
  const [operationsData, setOperationsData] = useState(initialOperationsData);

  const refreshDashboardData = useCallback(async () => {
    const response = await fetch("/api/live/dashboard", {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      dashboardData?: DashboardData;
      operationsData?: OperationsOverviewData;
    };

    if (payload.dashboardData) {
      setDashboardData(payload.dashboardData);
    }

    if (payload.operationsData) {
      setOperationsData(payload.operationsData);
    }
  }, []);

  useLiveSourceRefresh({
    sourceTables: LIVE_DASHBOARD_SOURCE_TABLES,
    onRefresh: refreshDashboardData,
  });

  const activityItems = useMemo(
    () => buildDashboardActivityItems(operationsData, dashboardData),
    [dashboardData, operationsData],
  );
  const totalAlertPages = Math.max(1, Math.ceil(activityItems.length / ALERTS_PER_PAGE));
  const safeAlertsPage = Math.min(initialAlertsPage, totalAlertPages);
  const pagedActivityItems = activityItems.slice(
    (safeAlertsPage - 1) * ALERTS_PER_PAGE,
    safeAlertsPage * ALERTS_PER_PAGE,
  );

  const totalVehiclePages = Math.max(1, Math.ceil(dashboardData.vehicles.length / VEHICLES_PER_PAGE));
  const safeVehiclesPage = Math.min(initialVehiclesPage, totalVehiclePages);
  const pagedVehicles = dashboardData.vehicles.slice(
    (safeVehiclesPage - 1) * VEHICLES_PER_PAGE,
    safeVehiclesPage * VEHICLES_PER_PAGE,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Carlytics Dashboard"
        description="Operativni pregled stanja flote, troškova i kritičnih upozorenja za dnevno upravljanje."
        showMobileViewButton
        actions={
          <>
            <DataFreshnessIndicator
              updatedAtIso={dashboardData.lastUpdatedIso}
              isUsingFallbackData={dashboardData.isUsingFallbackData}
            />
            <FallbackChip isUsingFallbackData={dashboardData.isUsingFallbackData} />
          </>
        }
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <FleetHealthCard summary={dashboardData.fleetHealth} />
        <CostAnalyticsCard
          series={dashboardData.costSeries}
          isUsingFallbackData={dashboardData.isUsingFallbackData}
        />
      </section>

      <section className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.85fr)]">
        <div className="flex h-full flex-col">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Vozila pod nadzorom</h2>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Prioritetno sortirano</p>
          </div>

          {pagedVehicles.length === 0 ? (
            <div className="flex flex-1 items-center rounded-xl border border-border bg-slate-950/55 px-4 py-4 text-sm text-muted">
              Trenutačno nema vozila koja zahtijevaju akciju.
            </div>
          ) : (
            <div className="grid flex-1 gap-3.5 md:auto-rows-fr md:grid-cols-2">
              {pagedVehicles.map((vehicle) => (
                <VehicleStatusCard key={vehicle.id} vehicle={vehicle} />
              ))}
            </div>
          )}

          <ServerPagination
            currentPage={safeVehiclesPage}
            totalPages={totalVehiclePages}
            className="mt-4 pt-2"
            hrefForPage={(page) =>
              buildDashboardHref({
                alertsPage: safeAlertsPage,
                vehiclesPage: page,
              })
            }
          />
        </div>

        <div className="flex h-full flex-col">
          <OperationsActivityFeed
            items={pagedActivityItems}
            totalItems={activityItems.length}
            currentPage={safeAlertsPage}
            totalPages={totalAlertPages}
            hrefForPage={(page) =>
              buildDashboardHref({
                alertsPage: page,
                vehiclesPage: safeVehiclesPage,
              })
            }
          />
        </div>
      </section>
    </div>
  );
}
