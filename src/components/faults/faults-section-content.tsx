"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

import { FallbackChip } from "@/components/dashboard/fallback-chip";
import { DesktopFaultReportForm } from "@/components/faults/desktop-fault-report-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { updateFaultStatusAction } from "@/lib/actions/fault-actions";
import type { VehicleListItem } from "@/lib/fleet/types";
import type { FaultCategoryOption } from "@/lib/fleet/worker-context-service";
import type {
  FaultQueueItem,
  OperationsOverviewData,
} from "@/lib/fleet/operations-service";

interface FaultsSectionContentProps {
  operationsData: OperationsOverviewData;
  vehicles: VehicleListItem[];
  categories: FaultCategoryOption[];
}

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

export function FaultsSectionContent({
  operationsData,
  vehicles,
  categories,
}: FaultsSectionContentProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openFaults = useMemo(
    () => operationsData.faultQueue.filter((fault) => fault.isOpen),
    [operationsData.faultQueue],
  );
  const recentlyClosed = useMemo(
    () => operationsData.faultQueue.filter((fault) => !fault.isOpen).slice(0, 6),
    [operationsData.faultQueue],
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Prijava kvara"
        description="Desktop operativa za prijavu novih kvarova, upravljanje statusima i brzu eskalaciju prema servisnom centru."
        actions={
          <>
            <button
              type="button"
              onClick={openModal}
              className="inline-flex h-9 items-center rounded-lg border border-cyan-300 bg-cyan-50 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700 transition hover:border-cyan-400 hover:bg-cyan-100 dark:border-cyan-500/35 dark:bg-cyan-500/12 dark:text-cyan-200 dark:hover:border-cyan-400/70 dark:hover:bg-cyan-500/22"
            >
              Nova prijava
            </button>
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

      <section className="grid gap-5">
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

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 px-3 py-4 sm:p-6">
          <button
            type="button"
            onClick={closeModal}
            aria-label="Zatvori modal prijave kvara"
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
          />

          <div className="relative mx-auto flex h-[min(95vh,920px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[0_0_0_1px_rgba(15,23,42,0.6),0_28px_80px_rgba(2,6,23,0.7)]">
            <div className="flex items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Nova prijava</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                  Unos novog kvara
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Prijavi novi kvar bez pomicanja postojećih operativnih sekcija.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/servisni-centar"
                  className="inline-flex h-10 items-center rounded-xl border border-border bg-surface px-3 text-xs font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200"
                >
                  Servisni centar
                </Link>

                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:border-cyan-500/45 hover:text-cyan-200"
                  aria-label="Zatvori modal"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              <DesktopFaultReportForm
                vehicles={vehicles}
                categories={categories}
                mode="modal"
                onCancel={closeModal}
                onSuccess={closeModal}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
