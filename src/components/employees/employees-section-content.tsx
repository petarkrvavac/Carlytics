"use client";

import { SlidersHorizontal, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils/cn";

type EmployeeStatusFilter = "aktivni" | "deaktivirani" | "svi";

interface EmployeesSectionContentProps {
  overviewData: EmployeesOverviewData;
  formContext: EmployeeFormContext;
}

const FILTERS: Array<{ key: EmployeeStatusFilter; label: string }> = [
  { key: "aktivni", label: "Aktivni" },
  { key: "deaktivirani", label: "Deaktivirani" },
  { key: "svi", label: "Svi" },
];

function getVisibleEmployees(
  employees: EmployeeOverviewItem[],
  filter: EmployeeStatusFilter,
) {
  if (filter === "aktivni") {
    return employees.filter((employee) => employee.isActive);
  }

  if (filter === "deaktivirani") {
    return employees.filter((employee) => !employee.isActive);
  }

  return employees;
}

export function EmployeesSectionContent({
  overviewData,
  formContext,
}: EmployeesSectionContentProps) {
  const [activeFilter, setActiveFilter] =
    useState<EmployeeStatusFilter>("aktivni");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const visibleEmployees = useMemo(
    () => getVisibleEmployees(overviewData.employees, activeFilter),
    [activeFilter, overviewData.employees],
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Zaposlenici"
        description="Pregled korisnika aplikacije s upravljanjem statusom i invitation tokom za postavu lozinke."
        actions={
          <>
            <FallbackChip isUsingFallbackData={overviewData.isUsingFallbackData} />
            <Badge variant="success">Aktivni: {overviewData.metrics.active}</Badge>
            <Badge variant="danger">Deaktivirani: {overviewData.metrics.deactivated}</Badge>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-cyan-300 bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              <Plus size={15} />
              Dodaj zaposlenika
            </button>
          </>
        }
      />

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted">
          <SlidersHorizontal size={14} />
          Filter po statusu
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveFilter(filter.key)}
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
          description="Promijeni filter ili dodaj novog zaposlenika kroz invitation tok."
          actionLabel="Dodaj zaposlenika"
          onActionClick={() => setIsModalOpen(true)}
        />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
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
                  <th className="px-3 py-3 text-right">Akcija</th>
                </tr>
              </thead>
              <tbody>
                {visibleEmployees.map((employee) => (
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
                    <td className="px-3 py-3 text-right">
                      <form action={updateEmployeeActivationAction}>
                        <input type="hidden" name="employeeId" value={employee.id} />
                        <input
                          type="hidden"
                          name="isAktivan"
                          value={employee.isActive ? "false" : "true"}
                        />
                        <button
                          type="submit"
                          onClick={(event) => {
                            if (!employee.isActive) {
                              return;
                            }

                            if (!window.confirm("Potvrdi deaktivaciju zaposlenika.")) {
                              event.preventDefault();
                            }
                          }}
                          className={cn(
                            "inline-flex h-8 items-center rounded-lg border px-3 text-xs font-semibold transition",
                            employee.isActive
                              ? "border-rose-300 bg-rose-100 text-rose-800 hover:bg-rose-200 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-200"
                              : "border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-200",
                          )}
                        >
                          {employee.isActive ? "Deaktiviraj" : "Aktiviraj"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {isModalOpen ? (
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
              <AddEmployeeForm
                formContext={formContext}
                onCancel={() => setIsModalOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
