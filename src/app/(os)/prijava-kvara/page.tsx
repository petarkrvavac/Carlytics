import Link from "next/link";

import { FallbackChip } from "@/components/dashboard/fallback-chip";
import { DesktopFaultReportForm } from "@/components/faults/desktop-fault-report-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { updateFaultStatusAction } from "@/lib/actions/fault-actions";
import { getFleetVehiclesSnapshot } from "@/lib/fleet/dashboard-service";
import {
  getOperationsOverviewData,
  type FaultQueueItem,
} from "@/lib/fleet/operations-service";
import { getFaultCategoryOptions } from "@/lib/fleet/worker-context-service";

function formatDateTime(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function getPriorityVariant(priority: FaultQueueItem["priority"]) {
  if (priority === "kriticno") {
    return "danger" as const;
  }

  if (priority === "visoko") {
    return "warning" as const;
  }

  if (priority === "nisko") {
    return "info" as const;
  }

  return "neutral" as const;
}

function getPriorityLabel(priority: FaultQueueItem["priority"]) {
  if (priority === "kriticno") {
    return "Kritično";
  }

  if (priority === "visoko") {
    return "Visoko";
  }

  if (priority === "nisko") {
    return "Nisko";
  }

  return "Srednje";
}

function getStatusVariant(statusLabel: string) {
  const normalized = statusLabel.toLowerCase();

  if (normalized.includes("zat")) {
    return "success" as const;
  }

  if (normalized.includes("obr")) {
    return "warning" as const;
  }

  return "danger" as const;
}

function getStatusValue(statusRaw: string | null) {
  const normalized = statusRaw?.toLowerCase() ?? "";

  if (normalized.includes("zat") || normalized.includes("closed") || normalized.includes("res")) {
    return "zatvoreno" as const;
  }

  if (normalized.includes("obr")) {
    return "u_obradi" as const;
  }

  return "novo" as const;
}

const STATUS_ACTIONS = [
  { value: "novo", label: "Postavi: novo" },
  { value: "u_obradi", label: "Postavi: u obradi" },
  { value: "zatvoreno", label: "Zatvori" },
] as const;

interface PrijavaKvaraPageProps {
  searchParams?: Promise<{ novaPrijava?: string }>;
}

export default async function PrijavaKvaraPage({ searchParams }: PrijavaKvaraPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const isNewFaultFormOpen = resolvedSearchParams?.novaPrijava === "1";
  const toggleNewFaultFormHref = isNewFaultFormOpen
    ? "/prijava-kvara"
    : "/prijava-kvara?novaPrijava=1";

  const [operationsData, vehicles, categories] = await Promise.all([
    getOperationsOverviewData(),
    getFleetVehiclesSnapshot(),
    getFaultCategoryOptions(),
  ]);

  const openFaults = operationsData.faultQueue.filter((fault) => fault.isOpen);
  const recentlyClosed = operationsData.faultQueue.filter((fault) => !fault.isOpen).slice(0, 6);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Prijava kvara"
        description="Desktop operativa za prijavu novih kvarova, upravljanje statusima i brzu eskalaciju prema servisnom centru."
        actions={
          <>
            <Link
              href={toggleNewFaultFormHref}
              className="inline-flex h-9 items-center rounded-lg border border-cyan-300 bg-cyan-50 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700 transition hover:border-cyan-400 hover:bg-cyan-100 dark:border-cyan-500/35 dark:bg-cyan-500/12 dark:text-cyan-200 dark:hover:border-cyan-400/70 dark:hover:bg-cyan-500/22"
            >
              {isNewFaultFormOpen ? "Sakrij novu prijavu" : "Nova prijava"}
            </Link>
            <FallbackChip isUsingFallbackData={operationsData.isUsingFallbackData} />
            <Badge variant={openFaults.length > 0 ? "warning" : "success"}>
              Otvoreno: {openFaults.length}
            </Badge>
            <Badge
              variant={operationsData.metrics.criticalFaults > 0 ? "danger" : "neutral"}
            >
              Kritične: {operationsData.metrics.criticalFaults}
            </Badge>
          </>
        }
      />

      <section
        className={
          isNewFaultFormOpen
            ? "grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"
            : "grid gap-5"
        }
      >
        {isNewFaultFormOpen ? (
          <Card>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                Nova prijava (desktop)
              </h2>
              <Link
                href="/servisni-centar"
                className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200"
              >
                Servisni centar
              </Link>
            </div>

            <DesktopFaultReportForm vehicles={vehicles} categories={categories} />
          </Card>
        ) : null}

        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
              Red prijava
            </h2>
            <Badge variant={openFaults.length > 0 ? "warning" : "success"}>
              Otvoreno: {openFaults.length}
            </Badge>
          </div>

          {operationsData.faultQueue.length === 0 ? (
            <p className="text-sm text-muted">Nema prijava kvarova za prikaz.</p>
          ) : (
            <ul className="max-h-[58vh] space-y-3 overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {operationsData.faultQueue.slice(0, 14).map((fault) => {
                const currentStatus = getStatusValue(fault.statusRaw);

                return (
                  <li key={fault.id} className="rounded-xl border border-border bg-surface px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">
                          {fault.vehicleLabel}
                          <span className="text-slate-400"> ({fault.plate})</span>
                        </p>
                        <p className="mt-1 text-sm text-slate-200">{fault.description}</p>
                        <p className="mt-1 text-xs text-muted">
                          Prijavio: {fault.reporterName} • {formatDateTime(fault.reportedAtIso)}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Badge variant={getPriorityVariant(fault.priority)}>
                          {getPriorityLabel(fault.priority)}
                        </Badge>
                        <Badge variant={getStatusVariant(fault.statusLabel)}>{fault.statusLabel}</Badge>
                      </div>
                    </div>

                    {fault.isOpen ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {STATUS_ACTIONS.map((statusAction) => (
                          <form key={statusAction.value} action={updateFaultStatusAction}>
                            <input type="hidden" name="faultId" value={fault.id} />
                            <input type="hidden" name="statusPrijave" value={statusAction.value} />
                            <button
                              type="submit"
                              disabled={currentStatus === statusAction.value}
                              className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition hover:border-cyan-500/50 hover:text-cyan-700 dark:hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {statusAction.label}
                            </button>
                          </form>
                        ))}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
            Operativni snapshot
          </h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
              <dt className="text-muted">Otvorene prijave</dt>
              <dd className="font-semibold text-amber-300">{operationsData.metrics.openFaults}</dd>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
              <dt className="text-muted">Kritične</dt>
              <dd className="font-semibold text-rose-300">{operationsData.metrics.criticalFaults}</dd>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
              <dt className="text-muted">Aktivna zaduženja</dt>
              <dd className="font-semibold text-sky-300">{operationsData.metrics.activeAssignments}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
            Nedavno zatvoreno
          </h3>

          {recentlyClosed.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nema zatvorenih prijava u zadnjem periodu.</p>
          ) : (
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {recentlyClosed.map((fault) => (
                <li key={fault.id} className="rounded-lg border border-border bg-surface px-3 py-2">
                  <p className="text-sm font-medium text-slate-100">{fault.vehicleLabel}</p>
                  <p className="mt-1 text-xs text-muted">{formatDateTime(fault.reportedAtIso)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
