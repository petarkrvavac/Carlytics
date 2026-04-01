"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { INITIAL_ACTION_STATE } from "@/lib/actions/action-state";
import { extendVehicleRegistrationAction } from "@/lib/actions/vehicle-actions";

interface RegistrationExtensionFormProps {
  vehicleId: number;
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getMessageClass(status: "idle" | "success" | "error") {
  if (status === "success") {
    return "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200";
  }

  if (status === "error") {
    return "rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200";
  }

  return "rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground";
}

export function RegistrationExtensionForm({ vehicleId }: RegistrationExtensionFormProps) {
  const router = useRouter();
  const lastRefreshKeyRef = useRef("");
  const [state, action, isPending] = useActionState(
    extendVehicleRegistrationAction,
    INITIAL_ACTION_STATE,
  );

  useEffect(() => {
    if (state.status !== "success" || !state.message) {
      return;
    }

    const refreshKey = `registration-extended:${state.message}`;

    if (lastRefreshKeyRef.current === refreshKey) {
      return;
    }

    lastRefreshKeyRef.current = refreshKey;
    router.refresh();
  }, [router, state.message, state.status]);

  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface px-3 py-2">
      <input type="hidden" name="vehicleId" value={vehicleId} />

      <label className="text-[11px] uppercase tracking-[0.16em] text-muted">
        Produži registraciju do
        <input
          type="date"
          name="datumIstekaRegistracije"
          required
          min={getTodayIsoDate()}
          disabled={isPending}
          className="mt-1 block rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground disabled:opacity-70"
        />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-8 items-center rounded-lg border border-cyan-300 bg-cyan-400 px-3 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "Spremam..." : "Produži"}
      </button>

      {state.fieldErrors?.datumIstekaRegistracije?.[0] ? (
        <p className="w-full text-xs text-rose-300">{state.fieldErrors.datumIstekaRegistracije[0]}</p>
      ) : null}

      {state.message ? <p className={`w-full ${getMessageClass(state.status)}`}>{state.message}</p> : null}
    </form>
  );
}
