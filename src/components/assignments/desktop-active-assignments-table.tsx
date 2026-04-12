"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { INITIAL_ACTION_STATE } from "@/lib/actions/action-state";
import { releaseDesktopAssignmentAction } from "@/lib/actions/assignment-actions";
import type { ActiveAssignmentOverviewItem } from "@/lib/fleet/operations-service";
import { formatDate } from "@/lib/utils/date-format";

interface DesktopActiveAssignmentsTableProps {
  assignments: ActiveAssignmentOverviewItem[];
}

function getMessageClass(status: "idle" | "success" | "error") {
  if (status === "success") {
    return "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200";
  }

  if (status === "error") {
    return "rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200";
  }

  return "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground";
}

export function DesktopActiveAssignmentsTable({ assignments }: DesktopActiveAssignmentsTableProps) {
  const lastHandledSuccessKeyRef = useRef("");
  const submittedAssignmentIdRef = useRef<number | null>(null);
  const [expandedAssignmentId, setExpandedAssignmentId] = useState<number | null>(null);
  const [visibleAssignments, setVisibleAssignments] = useState(assignments);

  const [releaseState, releaseAction, isPending] = useActionState(
    releaseDesktopAssignmentAction,
    INITIAL_ACTION_STATE,
  );

  useEffect(() => {
    setVisibleAssignments(assignments);
  }, [assignments]);

  useEffect(() => {
    if (releaseState.status !== "success" || !releaseState.message) {
      return;
    }

    const handledKey = `desktop-release:${releaseState.message}`;

    if (lastHandledSuccessKeyRef.current === handledKey) {
      return;
    }

    lastHandledSuccessKeyRef.current = handledKey;

    const releasedAssignmentId = submittedAssignmentIdRef.current;

    if (releasedAssignmentId === null) {
      return;
    }

    setVisibleAssignments((current) =>
      current.filter((assignment) => assignment.id !== releasedAssignmentId),
    );

    setExpandedAssignmentId((current) =>
      current === releasedAssignmentId ? null : current,
    );
  }, [releaseState.message, releaseState.status]);

  const renderReleaseControls = (
    assignment: ActiveAssignmentOverviewItem,
    mode: "table" | "card",
  ) => {
    if (expandedAssignmentId === assignment.id) {
      return (
        <form
          action={releaseAction}
          onSubmit={() => {
            submittedAssignmentIdRef.current = assignment.id;
          }}
          className={
            mode === "table"
              ? "ml-auto w-56 space-y-2 rounded-lg border border-border bg-surface p-2"
              : "w-full space-y-2 rounded-lg border border-border bg-surface p-2"
          }
        >
          <input type="hidden" name="assignmentId" value={assignment.id} />
          <label className="block text-left text-[10px] uppercase tracking-[0.16em] text-muted">
            Završna kilometraža
            <input
              type="number"
              name="kmZavrsna"
              required
              min={assignment.currentVehicleKm}
              step={1}
              disabled={isPending}
              className="mt-1.5 w-full rounded-md border border-border bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 disabled:opacity-70"
              placeholder={`Minimalno ${assignment.currentVehicleKm.toLocaleString("hr-HR")} km`}
            />
          </label>

          {releaseState.fieldErrors?.kmZavrsna?.[0] ? (
            <p className="text-left text-xs text-rose-300">{releaseState.fieldErrors.kmZavrsna[0]}</p>
          ) : null}

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setExpandedAssignmentId(null)}
              disabled={isPending}
              className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-slate-900/70 px-2 text-xs text-slate-200 transition hover:border-slate-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Odustani
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-8 items-center justify-center rounded-md border border-rose-400/45 bg-rose-100 px-2 text-xs font-semibold text-rose-800 transition hover:border-rose-500/70 hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25"
            >
              {isPending ? "Spremam..." : "Potvrdi"}
            </button>
          </div>
        </form>
      );
    }

    return (
      <button
        type="button"
        onClick={() => setExpandedAssignmentId(assignment.id)}
        className={
          mode === "table"
            ? "inline-flex h-8 items-center justify-center rounded-lg border border-rose-400/45 bg-rose-100 px-3 text-xs font-semibold text-rose-800 transition hover:border-rose-500/70 hover:bg-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25"
            : "inline-flex h-8 w-full items-center justify-center rounded-lg border border-rose-400/45 bg-rose-100 px-3 text-xs font-semibold text-rose-800 transition hover:border-rose-500/70 hover:bg-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25"
        }
      >
        Razduži vozilo
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2 lg:hidden">
        {visibleAssignments.map((assignment) => (
          <article key={`card-${assignment.id}`} className="rounded-xl border border-border bg-surface p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-slate-100">{assignment.employeeName}</p>
                <p className="text-xs text-muted">@{assignment.employeeUsername}</p>
              </div>

              <Badge
                variant={assignment.openFaultCount > 0 ? "warning" : "success"}
                className="justify-center"
              >
                Kvarovi: {assignment.openFaultCount}
              </Badge>
            </div>

            <div className="mt-2 rounded-lg border border-border/70 bg-background px-2.5 py-2">
              <p className="text-sm font-medium text-slate-100">{assignment.vehicleLabel}</p>
              <p className="text-xs text-muted">{assignment.plate}</p>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted">
              <p className="col-span-2">Od datuma: <span className="text-slate-200">{formatDate(assignment.startedAtIso)}</span></p>
              <p>KM start: <span className="data-font text-slate-200">{assignment.kmStart.toLocaleString("hr-HR")}</span></p>
              <p>KM trenutno: <span className="data-font text-slate-200">{assignment.currentVehicleKm.toLocaleString("hr-HR")}</span></p>
              <p className="col-span-2">Delta: <span className="data-font text-cyan-200">+{assignment.kmFromStart.toLocaleString("hr-HR")}</span></p>
            </div>

            <div className="mt-3">{renderReleaseControls(assignment, "card")}</div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-[0.2em] text-muted">
              <th className="px-2 py-2">Zaposlenik</th>
              <th className="px-2 py-2">Vozilo</th>
              <th className="px-2 py-2">Od datuma</th>
              <th className="px-2 py-2 text-right">KM start</th>
              <th className="px-2 py-2 text-right">KM trenutno</th>
              <th className="px-2 py-2 text-right">Delta</th>
              <th className="px-2 py-2 text-right">Kvarovi</th>
              <th className="px-2 py-2 text-right">Akcije</th>
            </tr>
          </thead>
          <tbody>
            {visibleAssignments.map((assignment) => (
              <tr key={assignment.id} className="border-b border-border/60 last:border-0">
                <td className="px-2 py-3">
                  <p className="font-medium text-slate-100">{assignment.employeeName}</p>
                  <p className="text-xs text-muted">@{assignment.employeeUsername}</p>
                </td>
                <td className="px-2 py-3">
                  <p className="font-medium text-slate-100">{assignment.vehicleLabel}</p>
                  <p className="text-xs text-muted">{assignment.plate}</p>
                </td>
                <td className="px-2 py-3 text-slate-300">{formatDate(assignment.startedAtIso)}</td>
                <td className="px-2 py-3 text-right data-font text-slate-200">
                  {assignment.kmStart.toLocaleString("hr-HR")}
                </td>
                <td className="px-2 py-3 text-right data-font text-slate-200">
                  {assignment.currentVehicleKm.toLocaleString("hr-HR")}
                </td>
                <td className="px-2 py-3 text-right data-font text-cyan-200">
                  +{assignment.kmFromStart.toLocaleString("hr-HR")}
                </td>
                <td className="px-2 py-3 text-right">
                  <Badge
                    variant={assignment.openFaultCount > 0 ? "warning" : "success"}
                    className="justify-center"
                  >
                    {assignment.openFaultCount}
                  </Badge>
                </td>
                <td className="px-2 py-3 text-right align-top">
                  {renderReleaseControls(assignment, "table")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {releaseState.message ? <div className={getMessageClass(releaseState.status)}>{releaseState.message}</div> : null}
    </div>
  );
}
