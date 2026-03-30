"use client";

import { useActionState } from "react";

import { INITIAL_ACTION_STATE } from "@/lib/actions/action-state";
import { submitFaultReportAction } from "@/lib/actions/fault-actions";
import type {
  ActiveWorkerVehicleContext,
  FaultCategoryOption,
} from "@/lib/fleet/worker-context-service";

interface FaultReportFormProps {
  categories: FaultCategoryOption[];
  activeContext: ActiveWorkerVehicleContext | null;
}

export function FaultReportForm({ categories, activeContext }: FaultReportFormProps) {
  const [state, formAction, isPending] = useActionState(
    submitFaultReportAction,
    INITIAL_ACTION_STATE,
  );

  const isDisabled = !activeContext;

  return (
    <form action={formAction} className="space-y-3 rounded-2xl border border-border bg-surface/90 p-4">
      <label className="block text-xs uppercase tracking-[0.2em] text-muted">
        Opis problema
        <textarea
          rows={4}
          name="opisProblema"
          disabled={isDisabled}
          placeholder="Npr. jaka vibracija na papučici kočnice..."
          className="mt-2 w-full rounded-xl border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-muted disabled:opacity-60"
        />
        {state.fieldErrors?.opisProblema?.[0] ? (
          <span className="mt-2 block text-xs normal-case tracking-normal text-rose-700 dark:text-rose-300">
            {state.fieldErrors.opisProblema[0]}
          </span>
        ) : null}
      </label>

      <label className="block text-xs uppercase tracking-[0.2em] text-muted">
        Kategorija
        <select
          name="kategorijaId"
          disabled={isDisabled}
          className="carlytics-select mt-2 w-full px-3 py-2.5 text-sm"
          defaultValue=""
        >
          <option value="">Odaberi kategoriju</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.naziv}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs uppercase tracking-[0.2em] text-muted">
        Hitnost
        <select
          name="hitnost"
          disabled={isDisabled}
          className="carlytics-select mt-2 w-full px-3 py-2.5 text-sm"
          defaultValue="srednje"
        >
          <option value="nisko">Nisko</option>
          <option value="srednje">Srednje</option>
          <option value="visoko">Visoko</option>
          <option value="kriticno">Kritično</option>
        </select>
      </label>

      <label className="block text-xs uppercase tracking-[0.2em] text-muted">
        Fotografija
        <input
          type="file"
          name="fotografija"
          disabled={isDisabled}
          className="mt-2 block w-full rounded-xl border border-dashed border-border bg-surface-elevated px-3 py-2 text-xs text-muted disabled:opacity-60"
        />
      </label>

      {state.message ? (
        <div
          className={
            state.status === "success"
              ? "rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200"
              : state.status === "error"
                ? "rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200"
                : "rounded-xl border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground"
          }
        >
          {state.message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending || isDisabled}
        className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-xl border border-cyan-500/35 bg-cyan-100 text-sm font-medium text-cyan-800 transition hover:border-cyan-500/55 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-cyan-500/16 dark:text-cyan-200 dark:hover:bg-cyan-500/28"
      >
        {isPending ? "Slanje..." : "Pošalji prijavu"}
      </button>
    </form>
  );
}
