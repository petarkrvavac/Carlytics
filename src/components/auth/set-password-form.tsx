"use client";

import { useActionState } from "react";

import { INITIAL_ACTION_STATE } from "@/lib/actions/action-state";
import { submitSetPasswordFromTokenAction } from "@/lib/actions/employee-actions";

interface SetPasswordFormProps {
  token: string;
}

export function SetPasswordForm({ token }: SetPasswordFormProps) {
  const [state, formAction, isPending] = useActionState(
    submitSetPasswordFromTokenAction,
    INITIAL_ACTION_STATE,
  );

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-border bg-surface/95 p-6">
      <input type="hidden" name="token" value={token} />

      <div>
        <label
          htmlFor="korisnickoIme"
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
        >
          Korisničko ime
        </label>
        <input
          id="korisnickoIme"
          name="korisnickoIme"
          required
          autoComplete="username"
          className="mt-2 w-full rounded-xl border border-border bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          placeholder="npr. marko.m"
        />
        {state.fieldErrors?.korisnickoIme?.[0] ? (
          <span className="mt-1 block text-xs text-rose-300">
            {state.fieldErrors.korisnickoIme[0]}
          </span>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="lozinka"
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
        >
          Lozinka
        </label>
        <input
          id="lozinka"
          name="lozinka"
          type="password"
          required
          autoComplete="new-password"
          className="mt-2 w-full rounded-xl border border-border bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          placeholder="Minimalno 8 znakova"
        />
        {state.fieldErrors?.lozinka?.[0] ? (
          <span className="mt-1 block text-xs text-rose-300">{state.fieldErrors.lozinka[0]}</span>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="potvrdaLozinke"
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
        >
          Potvrda lozinke
        </label>
        <input
          id="potvrdaLozinke"
          name="potvrdaLozinke"
          type="password"
          required
          autoComplete="new-password"
          className="mt-2 w-full rounded-xl border border-border bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          placeholder="Ponovi lozinku"
        />
        {state.fieldErrors?.potvrdaLozinke?.[0] ? (
          <span className="mt-1 block text-xs text-rose-300">
            {state.fieldErrors.potvrdaLozinke[0]}
          </span>
        ) : null}
      </div>

      {state.message ? (
        <div
          className={
            state.status === "error"
              ? "rounded-xl border border-rose-500/30 bg-rose-500/12 px-3 py-2 text-sm text-rose-200"
              : "rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
          }
        >
          {state.message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-cyan-500/35 bg-cyan-500/16 text-sm font-medium text-cyan-200 transition hover:border-cyan-400/70 hover:bg-cyan-500/22 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "Spremanje..." : "Postavi lozinku"}
      </button>
    </form>
  );
}
