"use client";

import Link from "next/link";
import { Loader2, Plus, RefreshCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { updateEmployeeActivationAction } from "@/lib/actions/employee-actions";
import type {
  EmployeeFormContext,
  EmployeeOverviewItem,
  EmployeesOverviewData,
} from "@/lib/employees/employee-service";
import { AddEmployeeForm } from "@/components/employees/add-employee-form";
import { FallbackChip } from "@/components/dashboard/fallback-chip";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageHeader } from "@/components/ui/page-header";
import { useLiveSourceRefresh } from "@/lib/hooks/use-live-source-refresh";
import { cn } from "@/lib/utils/cn";

const ITEMS_PER_PAGE = 10;
const LIVE_EMPLOYEE_SOURCE_TABLES = [
  "zaposlenici",
  "uloge",
  "mjesta",
  "zupanije",
  "drzave",
];

type EmployeeStatusFilter = "aktivni" | "deaktivirani" | "svi";
type FormContextLoadStatus = "idle" | "loading" | "ready" | "error";

interface EmployeesSectionContentProps {
  overviewData: EmployeesOverviewData;
  canManageEmployees: boolean;
}

const employeeFormContextSchema = z.object({
  roleOptions: z.array(
    z.object({
      id: z.number(),
      label: z.string(),
    }),
  ),
  countryOptions: z.array(
    z.object({
      id: z.number(),
      label: z.string(),
    }),
  ),
  countyOptions: z.array(
    z.object({
      id: z.number(),
      countryId: z.number().nullable(),
      label: z.string(),
    }),
  ),
  cityOptions: z.array(
    z.object({
      id: z.number(),
      countyId: z.number().nullable(),
      label: z.string(),
    }),
  ),
  isUsingFallbackData: z.boolean(),
});

const FILTERS: Array<{ key: EmployeeStatusFilter; label: string }> = [
  { key: "aktivni", label: "Aktivni" },
  { key: "deaktivirani", label: "Deaktivirani" },
  { key: "svi", label: "Svi" },
];

function getVisibleEmployees(
  employees: EmployeeOverviewItem[],
  filter: EmployeeStatusFilter,
  searchQuery: string,
) {
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const matchesSearch = (employee: EmployeeOverviewItem) => {
    if (!normalizedSearchQuery) {
      return true;
    }

    return `${employee.firstName} ${employee.lastName}`
      .toLowerCase()
      .includes(normalizedSearchQuery);
  };

  if (filter === "aktivni") {
    return employees.filter((employee) => employee.isActive && matchesSearch(employee));
  }

  if (filter === "deaktivirani") {
    return employees.filter((employee) => !employee.isActive && matchesSearch(employee));
  }

  return employees.filter(matchesSearch);
}

function hasErrorMessage(value: unknown): value is { message: string } {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { message?: unknown };
  return typeof candidate.message === "string";
}

function AddEmployeeFormSkeleton() {
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface/95 p-5">
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={`employee-modal-field-${index}`}
            className={`space-y-2 ${index === 2 || index === 5 ? "md:col-span-2" : ""}`}
          >
            <div className="skeleton-shimmer h-3 w-24 animate-pulse rounded-md bg-surface-elevated" />
            <div className="skeleton-shimmer h-10 w-full animate-pulse rounded-xl bg-surface-elevated" />
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-3">
        <div className="skeleton-shimmer ml-auto h-10 w-40 animate-pulse rounded-xl bg-surface-elevated" />
      </div>
    </div>
  );
}

export function EmployeesSectionContent({
  overviewData,
  canManageEmployees,
}: EmployeesSectionContentProps) {
  const [liveOverviewData, setLiveOverviewData] = useState(overviewData);
  const [activeFilter, setActiveFilter] =
    useState<EmployeeStatusFilter>("aktivni");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deactivationTarget, setDeactivationTarget] = useState<EmployeeOverviewItem | null>(null);
  const [deactivationReason, setDeactivationReason] = useState("");
  const [deactivationReasonError, setDeactivationReasonError] = useState("");
  const [formContext, setFormContext] = useState<EmployeeFormContext | null>(null);
  const [formContextStatus, setFormContextStatus] = useState<FormContextLoadStatus>("idle");
  const [formContextError, setFormContextError] = useState("");
  const deactivationFormRef = useRef<HTMLFormElement>(null);
  const deactivationEmployeeIdRef = useRef<HTMLInputElement>(null);
  const deactivationReasonRef = useRef<HTMLInputElement>(null);

  const refreshEmployeesData = useCallback(async () => {
    const response = await fetch("/api/live/employees", {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      overviewData?: EmployeesOverviewData;
    };

    if (!payload.overviewData) {
      return;
    }

    setLiveOverviewData(payload.overviewData);
  }, []);

  useLiveSourceRefresh({
    sourceTables: LIVE_EMPLOYEE_SOURCE_TABLES,
    onRefresh: refreshEmployeesData,
  });

  useEffect(() => {
    setLiveOverviewData(overviewData);
  }, [overviewData]);

  const visibleEmployees = useMemo(
    () => getVisibleEmployees(liveOverviewData.employees, activeFilter, searchQuery),
    [activeFilter, liveOverviewData.employees, searchQuery],
  );
  const totalPages = Math.max(1, Math.ceil(visibleEmployees.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedEmployees = useMemo(
    () =>
      visibleEmployees.slice(
        (safeCurrentPage - 1) * ITEMS_PER_PAGE,
        safeCurrentPage * ITEMS_PER_PAGE,
      ),
    [safeCurrentPage, visibleEmployees],
  );

  const isFormContextLoading = formContextStatus === "loading";

  useEffect(() => {
    if (!isModalOpen && !deactivationTarget) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [deactivationTarget, isModalOpen]);

  async function loadFormContext() {
    setFormContextStatus("loading");
    setFormContextError("");

    try {
      const response = await fetch("/api/zaposlenici/form-context", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      const payload: unknown = await response.json();

      if (!response.ok) {
        if (hasErrorMessage(payload)) {
          throw new Error(payload.message);
        }

        throw new Error("Neuspjelo dohvaćanje lookup podataka za formu zaposlenika.");
      }

      const parsedPayload = employeeFormContextSchema.safeParse(payload);

      if (!parsedPayload.success) {
        throw new Error("Primljen je neispravan format podataka za formu zaposlenika.");
      }

      setFormContext(parsedPayload.data);
      setFormContextStatus("ready");
    } catch (error) {
      setFormContext(null);
      setFormContextStatus("error");
      setFormContextError(
        error instanceof Error
          ? error.message
          : "Trenutno nije moguće učitati lookup podatke.",
      );
    }
  }

  function openAddEmployeeModal() {
    setIsModalOpen(true);

    if (formContext || isFormContextLoading) {
      return;
    }

    void loadFormContext();
  }

  function closeDeactivationModal() {
    setDeactivationTarget(null);
    setDeactivationReason("");
    setDeactivationReasonError("");
  }

  function submitEmployeeDeactivation() {
    if (!deactivationTarget) {
      return;
    }

    const normalizedReason = deactivationReason.trim();

    if (normalizedReason.length < 3) {
      setDeactivationReasonError("Razlog deaktivacije mora imati barem 3 znaka.");
      return;
    }

    if (deactivationEmployeeIdRef.current) {
      deactivationEmployeeIdRef.current.value = String(deactivationTarget.id);
    }

    if (deactivationReasonRef.current) {
      deactivationReasonRef.current.value = normalizedReason;
    }

    closeDeactivationModal();
    deactivationFormRef.current?.requestSubmit();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Zaposlenici"
        description="Pregled korisnika aplikacije s upravljanjem statusom i invitation tokom za postavu lozinke."
        actions={
          <>
            <FallbackChip isUsingFallbackData={liveOverviewData.isUsingFallbackData} />
            <Badge variant="success">Aktivni: {liveOverviewData.metrics.active}</Badge>
            <Badge variant="danger">Deaktivirani: {liveOverviewData.metrics.deactivated}</Badge>
            {canManageEmployees ? (
              <button
                type="button"
                onClick={openAddEmployeeModal}
                disabled={isFormContextLoading}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-cyan-300 bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                {isFormContextLoading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Plus size={15} />
                )}
                Dodaj zaposlenika
              </button>
            ) : null}
          </>
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
              placeholder="Pretraži ime i prezime"
              className="h-full w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
              aria-label="Pretraga zaposlenika"
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

      {visibleEmployees.length === 0 ? (
        <EmptyState
          title="Nema zaposlenika za odabrani filter"
          description={
            canManageEmployees
              ? "Promijeni filter ili dodaj novog zaposlenika kroz invitation tok."
              : "Promijeni filter za pregled zaposlenika."
          }
          actionLabel={canManageEmployees ? "Dodaj zaposlenika" : undefined}
          onActionClick={canManageEmployees ? openAddEmployeeModal : undefined}
        />
      ) : (
        <Card className="p-0">
          <div className="space-y-2 p-3 lg:hidden">
            {pagedEmployees.map((employee) => (
              <article key={`employee-card-${employee.id}`} className="rounded-xl border border-border bg-surface p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">
                      {employee.firstName} {employee.lastName}
                    </p>
                    <p className="text-xs text-muted">@{employee.username}</p>
                  </div>

                  <Badge variant={employee.isActive ? "success" : "danger"}>
                    {employee.isActive ? "Aktiviran" : "Deaktiviran"}
                  </Badge>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted">
                  <p>Uloga: <span className="text-slate-200">{employee.role}</span></p>
                  <p>Mjesto: <span className="text-slate-200">{employee.city ?? "-"}</span></p>
                  <p>Županija: <span className="text-slate-200">{employee.county ?? "-"}</span></p>
                  <p>Država: <span className="text-slate-200">{employee.country ?? "-"}</span></p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/zaposlenici/${employee.id}`}
                    className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200"
                  >
                    Profil aktivnosti
                  </Link>

                  {canManageEmployees ? (
                    employee.isActive ? (
                      <button
                        type="button"
                        onClick={() => {
                          setDeactivationTarget(employee);
                          setDeactivationReason("");
                          setDeactivationReasonError("");
                        }}
                        className="inline-flex h-8 items-center rounded-lg border border-rose-300 bg-rose-100 px-3 text-xs font-semibold text-rose-800 transition hover:bg-rose-200 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-200"
                      >
                        Deaktiviraj
                      </button>
                    ) : (
                      <form action={updateEmployeeActivationAction}>
                        <input type="hidden" name="employeeId" value={employee.id} />
                        <input type="hidden" name="isAktivan" value="true" />
                        <input type="hidden" name="razlogDeaktivacije" defaultValue="" />
                        <button
                          type="submit"
                          className="inline-flex h-8 items-center rounded-lg border border-emerald-300 bg-emerald-100 px-3 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-200 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-200"
                        >
                          Aktiviraj
                        </button>
                      </form>
                    )
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-[0.2em] text-muted">
                  <th className="px-3 py-3">Ime</th>
                  <th className="px-3 py-3">Prezime</th>
                  <th className="px-3 py-3">Korisničko ime</th>
                  <th className="px-3 py-3">Uloga</th>
                  <th className="px-3 py-3">Mjesto</th>
                  <th className="px-3 py-3">Županija</th>
                  <th className="px-3 py-3">Država</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Detalji</th>
                  {canManageEmployees ? <th className="px-3 py-3 text-right">Akcija</th> : null}
                </tr>
              </thead>
              <tbody>
                {pagedEmployees.map((employee) => (
                  <tr key={employee.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-3 font-medium text-slate-100">{employee.firstName}</td>
                    <td className="px-3 py-3 text-slate-200">{employee.lastName}</td>
                    <td className="px-3 py-3 text-slate-300">{employee.username}</td>
                    <td className="px-3 py-3 text-slate-200">{employee.role}</td>
                    <td className="px-3 py-3 text-slate-300">{employee.city ?? "-"}</td>
                    <td className="px-3 py-3 text-slate-300">{employee.county ?? "-"}</td>
                    <td className="px-3 py-3 text-slate-300">{employee.country ?? "-"}</td>
                    <td className="px-3 py-3">
                      <Badge variant={employee.isActive ? "success" : "danger"}>
                        {employee.isActive ? "Aktiviran" : "Deaktiviran"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/zaposlenici/${employee.id}`}
                        className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200"
                      >
                        Profil aktivnosti
                      </Link>
                    </td>
                    {canManageEmployees ? (
                      <td className="px-3 py-3 text-right">
                        {employee.isActive ? (
                          <button
                            type="button"
                            onClick={() => {
                              setDeactivationTarget(employee);
                              setDeactivationReason("");
                              setDeactivationReasonError("");
                            }}
                            className="inline-flex h-8 items-center rounded-lg border border-rose-300 bg-rose-100 px-3 text-xs font-semibold text-rose-800 transition hover:bg-rose-200 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-200"
                          >
                            Deaktiviraj
                          </button>
                        ) : (
                          <form action={updateEmployeeActivationAction}>
                            <input type="hidden" name="employeeId" value={employee.id} />
                            <input type="hidden" name="isAktivan" value="true" />
                            <input type="hidden" name="razlogDeaktivacije" defaultValue="" />
                            <button
                              type="submit"
                              className="inline-flex h-8 items-center rounded-lg border border-emerald-300 bg-emerald-100 px-3 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-200 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-200"
                            >
                              Aktiviraj
                            </button>
                          </form>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationControls
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            className="px-3 py-3"
          />
        </Card>
      )}

      {canManageEmployees ? (
        <form ref={deactivationFormRef} action={updateEmployeeActivationAction}>
          <input ref={deactivationEmployeeIdRef} type="hidden" name="employeeId" defaultValue="" />
          <input type="hidden" name="isAktivan" value="false" />
          <input ref={deactivationReasonRef} type="hidden" name="razlogDeaktivacije" defaultValue="" />
        </form>
      ) : null}

      {deactivationTarget && canManageEmployees ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-4 sm:p-6">
          <button
            type="button"
            onClick={closeDeactivationModal}
            aria-label="Zatvori popup razloga deaktivacije"
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          />

          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-background p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.6),0_28px_80px_rgba(2,6,23,0.7)]">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Deaktivacija zaposlenika</p>
                <h3 className="mt-2 text-lg font-semibold text-foreground">Unesi razlog deaktivacije</h3>
                <p className="mt-1 text-sm text-muted">
                  {deactivationTarget.firstName} {deactivationTarget.lastName}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDeactivationModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:border-cyan-500/45 hover:text-cyan-200"
                aria-label="Zatvori popup"
              >
                <X size={15} />
              </button>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-muted">Razlog</span>
              <textarea
                value={deactivationReason}
                onChange={(event) => {
                  setDeactivationReason(event.target.value);
                  if (deactivationReasonError) {
                    setDeactivationReasonError("");
                  }
                }}
                rows={4}
                placeholder="Npr. Korisnik više nije aktivan u operativnom timu."
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-cyan-500/45"
              />
            </label>

            {deactivationReasonError ? (
              <p className="mt-2 text-sm text-rose-300">{deactivationReasonError}</p>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeactivationModal}
                className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-xs font-semibold uppercase tracking-[0.12em] text-foreground transition hover:border-cyan-500/45 hover:text-cyan-200"
              >
                Odustani
              </button>
              <button
                type="button"
                onClick={submitEmployeeDeactivation}
                className="inline-flex h-9 items-center rounded-lg border border-rose-300 bg-rose-100 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-rose-800 transition hover:bg-rose-200 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-200"
              >
                Potvrdi deaktivaciju
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isModalOpen && canManageEmployees ? (
        <div className="fixed inset-0 z-50 px-3 py-4 sm:p-6">
          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            aria-label="Zatvori modal dodavanja zaposlenika"
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
          />

          <div className="relative mx-auto flex h-[min(92vh,980px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[0_0_0_1px_rgba(15,23,42,0.6),0_28px_80px_rgba(2,6,23,0.7)]">
            <div className="flex items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Dodaj zaposlenika</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                  Kreiranje korisnika i pozivnice
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Nakon spremanja generira se link za postavu korisničkog imena i lozinke.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:border-cyan-500/45 hover:text-cyan-200"
                aria-label="Zatvori modal"
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              {formContextStatus === "loading" ? (
                <AddEmployeeFormSkeleton />
              ) : formContextStatus === "error" ? (
                <div className="space-y-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                  <p>{formContextError || "Dohvaćanje podataka za formu nije uspjelo."}</p>
                  <button
                    type="button"
                    onClick={() => void loadFormContext()}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-400/45 bg-rose-500/15 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-rose-100 transition hover:bg-rose-500/25"
                  >
                    <RefreshCcw size={13} />
                    Pokušaj ponovno
                  </button>
                </div>
              ) : formContext ? (
                <AddEmployeeForm
                  formContext={formContext}
                  onCancel={() => setIsModalOpen(false)}
                />
              ) : (
                <AddEmployeeFormSkeleton />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
