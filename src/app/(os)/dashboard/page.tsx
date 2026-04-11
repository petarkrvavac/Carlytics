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
import { getOperationsOverviewData } from "@/lib/fleet/operations-service";
import { getDashboardData } from "@/lib/fleet/dashboard-service";
import { parsePageParam } from "@/lib/utils/page-params";

interface DashboardPageProps {
  searchParams?: Promise<{ upozorenja?: string }>;
}

const ALERTS_PER_PAGE = 10;

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
  operationsData: Awaited<ReturnType<typeof getOperationsOverviewData>>,
  dashboardData: Awaited<ReturnType<typeof getDashboardData>>,
) {
  const items: DashboardActivityItem[] = [
    ...dashboardData.criticalAlerts
      .filter((alert) => alert.type === "registracija")
      .map((alert) => {
        const vehicleId = Number(alert.id.replace("registracija-", ""));

        return {
          id: alert.id,
          occurredAtIso: alert.createdAtIso,
          type: "registracija" as const,
          title: alert.title,
          description: alert.description,
          href: Number.isInteger(vehicleId) && vehicleId > 0 ? `/flota/${vehicleId}` : "/flota",
          severity: alert.severity,
        };
      }),
    ...operationsData.faultQueue
      .filter((fault) => !isFaultInProgress(fault.statusRaw, fault.statusLabel))
      .map((fault) => ({
        id: `kvar-${fault.id}`,
        occurredAtIso: fault.reportedAtIso,
        type: "kvar" as const,
        title: `${fault.vehicleLabel} (${fault.plate})`,
        description: fault.description,
        href: fault.vehicleId ? `/prijava-kvara?vozilo=${fault.vehicleId}` : "/prijava-kvara",
        severity: getFaultSeverity(fault.priority),
      })),
    ...operationsData.serviceTimeline.map((service) => ({
      id: `servis-${service.id}`,
      occurredAtIso: service.startedAtIso,
      type: "servis" as const,
      title: `${service.vehicleLabel} (${service.plate})`,
      description: service.description,
      href: service.vehicleId
        ? `/prijava-kvara?vozilo=${service.vehicleId}`
        : "/prijava-kvara",
      severity: service.isOpen ? ("upozorenje" as const) : ("info" as const),
    })),
    ...operationsData.fuelLedger.map((entry) => ({
      id: `gorivo-${entry.id}`,
      occurredAtIso: entry.dateIso,
      type: "gorivo" as const,
      title: `${entry.vehicleLabel} (${entry.plate})`,
      description: `${entry.liters.toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L • ${entry.totalAmount.toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`,
      href: entry.vehicleId ? `/gorivo?vozilo=${entry.vehicleId}` : "/gorivo",
      severity: "info" as const,
    })),
    ...operationsData.activeAssignments.map((assignment) => ({
      id: `zaduzenje-${assignment.id}`,
      occurredAtIso: assignment.startedAtIso,
      type: "zaduzenje" as const,
      title: `${assignment.vehicleLabel} (${assignment.plate})`,
      description: `${assignment.employeeName} • +${assignment.kmFromStart.toLocaleString("hr-HR")} km`,
      href: "/zaduzenja",
      severity: assignment.openFaultCount > 0 ? ("upozorenje" as const) : ("info" as const),
    })),
  ];

  return items
    .sort((left, right) => {
      const severityDiff = getSeverityRank(left.severity) - getSeverityRank(right.severity);

      if (severityDiff !== 0) {
        return severityDiff;
      }

      const leftMs = new Date(left.occurredAtIso).getTime();
      const rightMs = new Date(right.occurredAtIso).getTime();
      return rightMs - leftMs;
    });
}

function buildDashboardHref(page: number) {
  if (page <= 1) {
    return "/dashboard";
  }

  const query = new URLSearchParams();
  query.set("upozorenja", String(page));
  return `/dashboard?${query.toString()}`;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const [dashboardData, operationsData] = await Promise.all([
    getDashboardData(),
    getOperationsOverviewData(),
  ]);

  const activityItems = buildDashboardActivityItems(operationsData, dashboardData);
  const currentAlertsPage = parsePageParam(resolvedSearchParams?.upozorenja);
  const totalAlertPages = Math.max(1, Math.ceil(activityItems.length / ALERTS_PER_PAGE));
  const safeAlertsPage = Math.min(currentAlertsPage, totalAlertPages);
  const pagedActivityItems = activityItems.slice(
    (safeAlertsPage - 1) * ALERTS_PER_PAGE,
    safeAlertsPage * ALERTS_PER_PAGE,
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

      <section className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Vozila pod nadzorom</h2>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Prioritetno sortirano</p>
          </div>

          <div className="grid gap-3.5 md:auto-rows-fr md:grid-cols-2">
            {dashboardData.vehicles.map((vehicle) => (
              <VehicleStatusCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        </div>

        <div className="flex h-full flex-col">
          <OperationsActivityFeed
            items={pagedActivityItems}
            totalItems={activityItems.length}
            currentPage={safeAlertsPage}
            totalPages={totalAlertPages}
            hrefForPage={buildDashboardHref}
          />
        </div>
      </section>
    </div>
  );
}
