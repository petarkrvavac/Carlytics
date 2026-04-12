"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";

import { INITIAL_ACTION_STATE } from "@/lib/actions/action-state";
import { submitFuelEntryAction } from "@/lib/actions/fuel-actions";
import type { ActiveWorkerVehicleContext } from "@/lib/fleet/worker-context-service";
import { useLiveSourceRefresh } from "@/lib/hooks/use-live-source-refresh";

const LIVE_WORKER_CONTEXT_SOURCE_TABLES = [
  "evidencija_goriva",
  "servisne_intervencije",
  "zaduzenja",
  "vozila",
  "registracije",
];

interface FuelEntryFormProps {
  activeContext: ActiveWorkerVehicleContext | null;
}

export function FuelEntryForm({ activeContext }: FuelEntryFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [localActiveContext, setLocalActiveContext] = useState(activeContext);
  const [state, formAction, isPending] = useActionState(
    submitFuelEntryAction,
    INITIAL_ACTION_STATE,
  );

  const refreshWorkerContext = useCallback(async () => {
    const response = await fetch("/api/live/worker-context", {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      activeContext?: ActiveWorkerVehicleContext | null;
    };

    setLocalActiveContext(payload.activeContext ?? null);
  }, []);

  useLiveSourceRefresh({
    sourceTables: LIVE_WORKER_CONTEXT_SOURCE_TABLES,
    onRefresh: refreshWorkerContext,
  });

  useEffect(() => {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const kmInput = form.elements.namedItem("kmTocenja") as HTMLInputElement | null;

    if (!kmInput) {
      return;
    }

    kmInput.value = localActiveContext ? String(localActiveContext.currentKm) : "";
  }, [localActiveContext]);

  useEffect(() => {
    if (state.status !== "success") {
      return;
    }

    const form = formRef.current;

    if (!form) {
      return;
    }

    const kmInput = form.elements.namedItem("kmTocenja") as HTMLInputElement | null;
    const nextKm = state.payload?.kmTocenja;

    form.reset();

    if (kmInput && typeof nextKm === "number") {
      kmInput.value = String(nextKm);
      return;
    }

    if (kmInput && localActiveContext) {
      kmInput.value = String(localActiveContext.currentKm);
    }
  }, [localActiveContext, state.payload, state.status]);

  const isDisabled = !localActiveContext;

  return (
    <form ref={formRef} action={formAction} className="space-y-3 rounded-2xl border border-border bg-surface/90 p-4">
      <label className="block text-xs uppercase tracking-[0.2em] text-muted">
        Trenutačna kilometraža
        <input
          type="number"
          name="kmTocenja"
          disabled={isDisabled}
          defaultValue={localActiveContext?.currentKm ?? ""}
          placeholder="142350"
          className="mt-2 w-full rounded-xl border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-muted disabled:opacity-60"
        />
        {state.fieldErrors?.kmTocenja?.[0] ? (
          <span className="mt-2 block text-xs normal-case tracking-normal text-rose-700 dark:text-rose-300">
            {state.fieldErrors.kmTocenja[0]}
          </span>
        ) : null}
      </label>

      <label className="block text-xs uppercase tracking-[0.2em] text-muted">
        Litraža
        <input
          type="number"
          step="0.01"
          name="litraza"
          disabled={isDisabled}
          placeholder="37"
          className="mt-2 w-full rounded-xl border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-muted disabled:opacity-60"
        />
        {state.fieldErrors?.litraza?.[0] ? (
          <span className="mt-2 block text-xs normal-case tracking-normal text-rose-700 dark:text-rose-300">
            {state.fieldErrors.litraza[0]}
          </span>
        ) : null}
      </label>

      <label className="block text-xs uppercase tracking-[0.2em] text-muted">
        Cijena po litri
        <input
          type="number"
          step="0.01"
          name="cijenaPoLitri"
          disabled={isDisabled}
          placeholder="1.56"
          className="mt-2 w-full rounded-xl border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-muted disabled:opacity-60"
        />
        {state.fieldErrors?.cijenaPoLitri?.[0] ? (
          <span className="mt-2 block text-xs normal-case tracking-normal text-rose-700 dark:text-rose-300">
            {state.fieldErrors.cijenaPoLitri[0]}
          </span>
        ) : null}
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
        {isPending ? "Spremanje..." : "Spremi unos"}
      </button>
    </form>
  );
}
