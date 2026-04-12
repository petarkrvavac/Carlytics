"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

import { AttachmentViewerButton } from "@/components/attachments/attachment-viewer-button";
import { FallbackChip } from "@/components/dashboard/fallback-chip";
import {
  DesktopFaultReportForm,
  type DesktopFaultReportSuccessPayload,
} from "@/components/faults/desktop-fault-report-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageHeader } from "@/components/ui/page-header";
import { updateFaultStatusAction } from "@/lib/actions/fault-actions";
import type { VehicleListItem } from "@/lib/fleet/types";
import type { FaultCategoryOption } from "@/lib/fleet/worker-context-service";
import { useLiveSourceRefresh } from "@/lib/hooks/use-live-source-refresh";
import { formatDateTime } from "@/lib/utils/date-format";
import type {
  FaultQueueItem,
  OperationsOverviewData,
} from "@/lib/fleet/operations-service";

interface FaultsSectionContentProps {
  operationsData: OperationsOverviewData;
  vehicles: VehicleListItem[];
  categories: FaultCategoryOption[];
  selectedVehicleId: number | null;
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

  if (
    normalized.includes("zat") ||
    normalized.includes("rije") ||
    normalized.includes("rijes") ||
    normalized.includes("closed") ||
    normalized.includes("res")
  ) {
    return "success" as const;
  }

  if (normalized.includes("obr")) {
    return "warning" as const;
  }

  return "danger" as const;
}

function getStatusValue(statusRaw: string | null) {
  const normalized = statusRaw?.toLowerCase() ?? "";

  if (
    normalized.includes("zat") ||
    normalized.includes("rije") ||
    normalized.includes("rijes") ||
    normalized.includes("closed") ||
    normalized.includes("res")
  ) {
    return "zatvoreno" as const;
  }

  if (normalized.includes("obr")) {
    return "u_obradi" as const;
  }

  return "novo" as const;
}

type FaultStatusValue = ReturnType<typeof getStatusValue>;

const STATUS_OPTIONS: Array<{ value: FaultStatusValue; label: string }> = [
  { value: "novo", label: "Novo" },
  { value: "u_obradi", label: "U obradi" },
  { value: "zatvoreno", label: "Riješeno" },
];

const ITEMS_PER_PAGE = 10;
const LIVE_FAULT_SOURCE_TABLES = ["servisne_intervencije"];

export function FaultsSectionContent({
  operationsData,
  vehicles,
  categories,
  selectedVehicleId,
}: FaultsSectionContentProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusDraftByFault, setStatusDraftByFault] = useState<Record<number, FaultStatusValue>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [serverFaultQueue, setServerFaultQueue] = useState(operationsData.faultQueue);
  const [isUsingFallbackData, setIsUsingFallbackData] = useState(operationsData.isUsingFallbackData);
  const [insertedFaults, setInsertedFaults] = useState<FaultQueueItem[]>([]);

  const refreshFaultQueue = useCallback(async () => {
    const response = await fetch("/api/live/operations", {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      operationsData?: OperationsOverviewData;
    };

    if (!payload.operationsData) {
      return;
    }

    setServerFaultQueue(payload.operationsData.faultQueue);
    setIsUsingFallbackData(payload.operationsData.isUsingFallbackData);
  }, []);

  useLiveSourceRefresh({
    sourceTables: LIVE_FAULT_SOURCE_TABLES,
    onRefresh: refreshFaultQueue,
  });

  const combinedFaultQueue = useMemo(() => {
    if (insertedFaults.length === 0) {
      return serverFaultQueue;
    }

    const insertedIds = new Set(insertedFaults.map((fault) => fault.id));

    return [
      ...insertedFaults,
      ...serverFaultQueue.filter((fault) => !insertedIds.has(fault.id)),
    ];
  }, [insertedFaults, serverFaultQueue]);

  const openFaults = useMemo(() => {
    return combinedFaultQueue.filter((fault) => {
      if (!fault.isOpen) {
        return false;
      }

      if (!selectedVehicleId) {
        return true;
      }

      return fault.vehicleId === selectedVehicleId;
    });
  }, [combinedFaultQueue, selectedVehicleId]);

  const selectedVehicle = useMemo(() => {
    if (!selectedVehicleId) {
      return null;
    }

    return vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null;
  }, [selectedVehicleId, vehicles]);

  const criticalOpenFaults = useMemo(
    () => openFaults.filter((fault) => fault.priority === "kriticno").length,
    [openFaults],
  );

  const totalPages = Math.max(1, Math.ceil(openFaults.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedOpenFaults = useMemo(
    () =>
      openFaults.slice(
        (safeCurrentPage - 1) * ITEMS_PER_PAGE,
        safeCurrentPage * ITEMS_PER_PAGE,
      ),
    [openFaults, safeCurrentPage],
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

  const handleFaultReportSuccess = useCallback(
    (payload: DesktopFaultReportSuccessPayload | null) => {
      if (payload) {
        const vehicle = vehicles.find((vehicleItem) => vehicleItem.id === payload.vehicleId) ?? null;
        const category =
          payload.categoryId !== null
            ? (categories.find((categoryOption) => categoryOption.id === payload.categoryId) ?? null)
            : null;
        const fallbackFaultTimestamp = new Date(payload.reportedAtIso).getTime();
        const fallbackFaultId = Number.isNaN(fallbackFaultTimestamp)
          ? Date.now()
          : fallbackFaultTimestamp;

        const nextFault: FaultQueueItem = {
          id: payload.faultId ?? fallbackFaultId,
          reportedAtIso: payload.reportedAtIso,
          attachmentUrl: payload.attachmentUrl,
          vehicleId: payload.vehicleId,
          vehicleLabel: vehicle ? `${vehicle.make} ${vehicle.model}` : "Nepoznato vozilo",
          plate: vehicle?.plate ?? "N/A",
          reporterName: payload.reporterName,
          description: payload.description,
          categoryId: payload.categoryId,
          categoryLabel: category?.naziv ?? null,
          priority: payload.priority,
          statusRaw: payload.statusRaw,
          statusLabel: "Novo",
          isOpen: true,
        };

        setInsertedFaults((current) => [nextFault, ...current.filter((fault) => fault.id !== nextFault.id)]);
        setCurrentPage(1);
      }

      setIsModalOpen(false);
    },
    [categories, vehicles],
  );

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
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-cyan-300 bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              <Plus size={15} />
              Nova prijava
            </button>
            <FallbackChip isUsingFallbackData={isUsingFallbackData} />
          </>
        }
      />

      <section className="grid gap-5">
        <Card>
          {selectedVehicleId ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
              <Badge variant="info">
                Aktivan filter: {selectedVehicle?.make ?? "Vozilo"} {selectedVehicle?.model ?? "#"}
                {selectedVehicle?.plate ? ` (${selectedVehicle.plate})` : ""}
              </Badge>
              <Link
                href="/prijava-kvara"
                className="inline-flex h-7 items-center rounded-lg border border-border bg-surface px-2.5 text-[11px] font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200"
              >
                Očisti filter
              </Link>
            </div>
          ) : null}

          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
              Red prijava
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={openFaults.length > 0 ? "warning" : "success"}>
                Otvoreno: {openFaults.length}
              </Badge>
              <Badge variant={criticalOpenFaults > 0 ? "danger" : "neutral"}>
                Kritične: {criticalOpenFaults}
              </Badge>
            </div>
          </div>

          {openFaults.length === 0 ? (
            <p className="text-sm text-muted">Nema prijava kvarova za prikaz.</p>
          ) : (
            <>
              <ul className="space-y-3">
                {pagedOpenFaults.map((fault) => {
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

                      <div className="mt-3 flex flex-wrap gap-2">
                        <AttachmentViewerButton
                          attachmentSource={fault.attachmentUrl}
                          title={`${fault.vehicleLabel} (${fault.plate})`}
                        />

                        {fault.isOpen ? (
                          <>
                            <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5">
                              <label className="text-xs text-muted" htmlFor={`status-${fault.id}`}>
                                Status
                              </label>
                              <select
                                id={`status-${fault.id}`}
                                value={statusDraftByFault[fault.id] ?? currentStatus}
                                onChange={(event) => {
                                  const nextStatus = event.target.value as FaultStatusValue;
                                  setStatusDraftByFault((current) => ({
                                    ...current,
                                    [fault.id]: nextStatus,
                                  }));
                                }}
                                className="carlytics-select h-8 rounded-lg px-2 text-xs"
                              >
                                {STATUS_OPTIONS.map((statusOption) => (
                                  <option key={statusOption.value} value={statusOption.value}>
                                    {statusOption.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {(statusDraftByFault[fault.id] ?? currentStatus) === "zatvoreno" &&
                            (statusDraftByFault[fault.id] ?? currentStatus) !== currentStatus ? (
                              <form
                                action={updateFaultStatusAction}
                                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5"
                              >
                                <input type="hidden" name="faultId" value={fault.id} />
                                <input type="hidden" name="statusPrijave" value="zatvoreno" />

                                <label className="flex items-center gap-2 text-xs text-muted">
                                  Cijena
                                  <input
                                    type="number"
                                    name="cijena"
                                    min="0"
                                    step="0.01"
                                    required
                                    placeholder="0.00"
                                    className="h-8 w-28 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                                  />
                                </label>

                                <button
                                  type="submit"
                                  className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition hover:border-cyan-500/50 hover:text-cyan-700 dark:hover:text-cyan-200"
                                >
                                  Potvrdi rješavanje
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setStatusDraftByFault((current) => ({
                                      ...current,
                                      [fault.id]: currentStatus,
                                    }));
                                  }}
                                  className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200"
                                >
                                  Odustani
                                </button>
                              </form>
                            ) : null}

                            {(statusDraftByFault[fault.id] ?? currentStatus) !== currentStatus &&
                            (statusDraftByFault[fault.id] ?? currentStatus) !== "zatvoreno" ? (
                              <form action={updateFaultStatusAction}>
                                <input type="hidden" name="faultId" value={fault.id} />
                                <input
                                  type="hidden"
                                  name="statusPrijave"
                                  value={statusDraftByFault[fault.id] ?? currentStatus}
                                />
                                <button
                                  type="submit"
                                  className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition hover:border-cyan-500/50 hover:text-cyan-700 dark:hover:text-cyan-200"
                                >
                                  Spremi status
                                </button>
                              </form>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <PaginationControls
                currentPage={safeCurrentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </>
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

          <div className="relative mx-auto flex h-[min(88vh,820px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[0_0_0_1px_rgba(15,23,42,0.6),0_28px_80px_rgba(2,6,23,0.7)]">
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
                  href="/povijest-servisa"
                  className="inline-flex h-10 items-center rounded-xl border border-border bg-surface px-3 text-xs font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200"
                >
                  Povijest servisa
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
                onSuccess={handleFaultReportSuccess}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
