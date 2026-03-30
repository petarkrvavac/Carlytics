import Link from "next/link";

import { CostAnalyticsCard } from "@/components/dashboard/cost-analytics-card";
import { CriticalAlertsCard } from "@/components/dashboard/critical-alerts-card";
import { FallbackChip } from "@/components/dashboard/fallback-chip";
import { FleetHealthCard } from "@/components/dashboard/fleet-health-card";
import {
  OperationsActivityFeed,
  type DashboardActivityItem,
} from "@/components/dashboard/operations-activity-feed";
import { DataFreshnessIndicator } from "@/components/layout/data-freshness-indicator";
import { VehicleStatusCard } from "@/components/fleet/vehicle-status-card";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getOperationsOverviewData } from "@/lib/fleet/operations-service";
import { getDashboardData } from "@/lib/fleet/dashboard-service";
import type { CostCompareMode } from "@/components/dashboard/cost-analytics-card";

interface DashboardPageProps {
  searchParams?: Promise<{ usporedba?: string }>;
}

function resolveCompareMode(value: string | undefined): CostCompareMode {
  if (value === "ukupno" || value === "razlika") {
    return value;
  }

  return "standard";
}

function getFaultSeverity(priority: string) {
  if (priority === "kriticno") {
    return "kriticno" as const;
  }

  if (priority === "visoko") {
    return "upozorenje" as const;
  }

  return "info" as const;
}

function buildDashboardActivityItems(operationsData: Awaited<ReturnType<typeof getOperationsOverviewData>>) {
  const items: DashboardActivityItem[] = [
    ...operationsData.faultQueue.slice(0, 4).map((fault) => ({
      id: `kvar-${fault.id}`,
      occurredAtIso: fault.reportedAtIso,
      type: "kvar" as const,
      title: `${fault.vehicleLabel} (${fault.plate})`,
      description: fault.description,
      href: "/prijava-kvara",
      severity: getFaultSeverity(fault.priority),
    })),
    ...operationsData.serviceTimeline.slice(0, 4).map((service) => ({
      id: `servis-${service.id}`,
      occurredAtIso: service.startedAtIso,
      type: "servis" as const,
      title: `${service.vehicleLabel} (${service.plate})`,
      description: service.description,
      href: "/servisni-centar",
      severity: service.isOpen ? ("upozorenje" as const) : ("info" as const),
    })),
    ...operationsData.fuelLedger.slice(0, 4).map((entry) => ({
      id: `gorivo-${entry.id}`,
      occurredAtIso: entry.dateIso,
      type: "gorivo" as const,
      title: `${entry.vehicleLabel} (${entry.plate})`,
      description: `${entry.liters.toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L • ${entry.totalAmount.toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`,
      href: "/gorivo",
      severity: "info" as const,
    })),
    ...operationsData.activeAssignments.slice(0, 4).map((assignment) => ({
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
      const leftMs = new Date(left.occurredAtIso).getTime();
      const rightMs = new Date(right.occurredAtIso).getTime();
      return rightMs - leftMs;
    })
    .slice(0, 10);
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const compareMode = resolveCompareMode(resolvedSearchParams?.usporedba);

  const [dashboardData, operationsData] = await Promise.all([
    getDashboardData(),
    getOperationsOverviewData(),
  ]);

  const activityItems = buildDashboardActivityItems(operationsData);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Carlytics Dashboard"
        description="Operativni pregled stanja flote, troškova i kritičnih upozorenja za dnevno upravljanje."
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

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
        <div className="grid content-start gap-4">
          <Card className="w-full max-w-full border-sky-200 bg-linear-to-r from-sky-50 to-cyan-50 p-3 pb-2.5 shadow-[0_0_0_1px_rgba(14,116,144,0.08),0_8px_18px_rgba(3,105,161,0.08)] dark:border-cyan-500/25 dark:bg-linear-to-r dark:from-slate-900 dark:to-slate-800/85 dark:shadow-[0_0_0_1px_rgba(6,182,212,0.12),0_10px_20px_rgba(2,6,23,0.34)]">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between xl:gap-3">
              <p className="text-xs text-slate-700 sm:text-sm dark:text-slate-200">
                Kontekstna usporedba troškova:
                <span className="ml-2 font-semibold text-cyan-700 dark:text-cyan-200">
                  {compareMode === "ukupno"
                    ? "Ukupni mjesečni trend"
                    : compareMode === "razlika"
                      ? "Razlika servis - gorivo"
                      : "Gorivo vs servis"}
                </span>
              </p>

              <div className="flex flex-wrap gap-1.5">
                <Link
                  href="/dashboard?usporedba=standard"
                  className={`inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition ${
                    compareMode === "standard"
                      ? "border-cyan-500/60 bg-cyan-100 text-cyan-900 dark:bg-cyan-400/15 dark:text-cyan-200"
                      : "border-slate-300 bg-white text-slate-700 hover:border-cyan-500/45 hover:bg-cyan-50 hover:text-cyan-800 dark:border-border dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-cyan-200"
                  }`}
                >
                  Standard
                </Link>
                <Link
                  href="/dashboard?usporedba=ukupno"
                  className={`inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition ${
                    compareMode === "ukupno"
                      ? "border-cyan-500/60 bg-cyan-100 text-cyan-900 dark:bg-cyan-400/15 dark:text-cyan-200"
                      : "border-slate-300 bg-white text-slate-700 hover:border-cyan-500/45 hover:bg-cyan-50 hover:text-cyan-800 dark:border-border dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-cyan-200"
                  }`}
                >
                  Ukupno
                </Link>
                <Link
                  href="/dashboard?usporedba=razlika"
                  className={`inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition ${
                    compareMode === "razlika"
                      ? "border-cyan-500/60 bg-cyan-100 text-cyan-900 dark:bg-cyan-400/15 dark:text-cyan-200"
                      : "border-slate-300 bg-white text-slate-700 hover:border-cyan-500/45 hover:bg-cyan-50 hover:text-cyan-800 dark:border-border dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-cyan-200"
                  }`}
                >
                  Razlika
                </Link>
              </div>
            </div>
          </Card>

          <FleetHealthCard summary={dashboardData.fleetHealth} />
          <CostAnalyticsCard
            series={dashboardData.costSeries}
            mode={compareMode}
            isUsingFallbackData={dashboardData.isUsingFallbackData}
          />
        </div>
        <CriticalAlertsCard alerts={dashboardData.criticalAlerts} />
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Vozila pod nadzorom</h2>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Prioritetno sortirano</p>
          </div>

          <div className="grid gap-3.5 md:grid-cols-2">
            {dashboardData.vehicles.map((vehicle) => (
              <VehicleStatusCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        </div>

        <OperationsActivityFeed items={activityItems} />
      </section>
    </div>
  );
}
