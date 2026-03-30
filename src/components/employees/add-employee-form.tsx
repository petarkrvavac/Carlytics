"use client";

import { Check, Copy } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import { createEmployeeInviteAction } from "@/lib/actions/employee-actions";
import type { EmployeeFormContext } from "@/lib/employees/employee-service";

const INITIAL_EMPLOYEE_INVITE_ACTION_STATE = {
  status: "idle" as const,
  message: "",
  inviteLink: "",
};

interface AddEmployeeFormProps {
  formContext: EmployeeFormContext;
  onCancel?: () => void;
}

export function AddEmployeeForm({ formContext, onCancel }: AddEmployeeFormProps) {
  const [state, formAction, isPending] = useActionState(
    createEmployeeInviteAction,
    INITIAL_EMPLOYEE_INVITE_ACTION_STATE,
  );
  const [selectedCountryId, setSelectedCountryId] = useState<string>("");
  const [selectedCountyId, setSelectedCountyId] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState("");

  const availableCounties = useMemo(() => {
    if (!selectedCountryId) {
      return [];
    }

    return formContext.countyOptions.filter(
      (county) => String(county.countryId) === selectedCountryId,
    );
  }, [formContext.countyOptions, selectedCountryId]);

  const availableCities = useMemo(() => {
    if (!selectedCountyId) {
      return [];
    }

    return formContext.cityOptions.filter(
      (city) => String(city.countyId) === selectedCountyId,
    );
  }, [formContext.cityOptions, selectedCountyId]);

  const isCopied = Boolean(state.inviteLink) && copiedLink === state.inviteLink;

  async function handleCopyInviteLink() {
    if (!state.inviteLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(state.inviteLink);
      setCopiedLink(state.inviteLink);
    } catch {
      setCopiedLink("");
    }
  }

  const hasRequiredContext =
    formContext.roleOptions.length > 0 &&
    formContext.countryOptions.length > 0 &&
    formContext.countyOptions.length > 0 &&
    formContext.cityOptions.length > 0;

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-border bg-surface/95 p-5">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs uppercase tracking-[0.2em] text-muted">
          Ime
          <input
            name="ime"
            required
            disabled={!hasRequiredContext}
            className="mt-2 w-full rounded-xl border border-border bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 disabled:opacity-60"
            placeholder="Marko"
          />
          {state.fieldErrors?.ime?.[0] ? (
            <span className="mt-1 block text-xs normal-case tracking-normal text-rose-300">
              {state.fieldErrors.ime[0]}
            </span>
          ) : null}
        </label>

        <label className="text-xs uppercase tracking-[0.2em] text-muted">
          Prezime
          <input
            name="prezime"
            required
            disabled={!hasRequiredContext}
            className="mt-2 w-full rounded-xl border border-border bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 disabled:opacity-60"
            placeholder="Marić"
          />
          {state.fieldErrors?.prezime?.[0] ? (
            <span className="mt-1 block text-xs normal-case tracking-normal text-rose-300">
              {state.fieldErrors.prezime[0]}
            </span>
          ) : null}
        </label>

        <label className="text-xs uppercase tracking-[0.2em] text-muted md:col-span-2">
          Email
          <input
            name="email"
            type="email"
            required
            disabled={!hasRequiredContext}
            className="mt-2 w-full rounded-xl border border-border bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 disabled:opacity-60"
            placeholder="marko.maric@carlytics.hr"
          />
          {state.fieldErrors?.email?.[0] ? (
            <span className="mt-1 block text-xs normal-case tracking-normal text-rose-300">
              {state.fieldErrors.email[0]}
            </span>
          ) : null}
        </label>

        <label className="text-xs uppercase tracking-[0.2em] text-muted md:col-span-2">
          Uloga
          <select
            name="ulogaId"
            required
            disabled={!hasRequiredContext}
            defaultValue=""
            className="carlytics-select mt-2 w-full px-3 py-2 text-sm"
          >
            <option value="">Odaberi ulogu</option>
            {formContext.roleOptions.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>
          {state.fieldErrors?.ulogaId?.[0] ? (
            <span className="mt-1 block text-xs normal-case tracking-normal text-rose-300">
              {state.fieldErrors.ulogaId[0]}
            </span>
          ) : null}
        </label>

        <label className="text-xs uppercase tracking-[0.2em] text-muted">
          Država
          <select
            required
            disabled={!hasRequiredContext}
            value={selectedCountryId}
            onChange={(event) => {
              setSelectedCountryId(event.target.value);
              setSelectedCountyId("");
            }}
            className="carlytics-select mt-2 w-full px-3 py-2 text-sm"
          >
            <option value="">Odaberi državu</option>
            {formContext.countryOptions.map((country) => (
              <option key={country.id} value={country.id}>
                {country.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs uppercase tracking-[0.2em] text-muted">
          Županija
          <select
            required
            disabled={!selectedCountryId}
            value={selectedCountyId}
            onChange={(event) => setSelectedCountyId(event.target.value)}
            className="carlytics-select mt-2 w-full px-3 py-2 text-sm"
          >
            <option value="">Odaberi županiju</option>
            {availableCounties.map((county) => (
              <option key={county.id} value={county.id}>
                {county.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs uppercase tracking-[0.2em] text-muted md:col-span-2">
          Mjesto
          <select
            name="mjestoId"
            required
            disabled={!selectedCountyId}
            defaultValue=""
            className="carlytics-select mt-2 w-full px-3 py-2 text-sm"
          >
            <option value="">Odaberi mjesto</option>
            {availableCities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.label}
              </option>
            ))}
          </select>
          {state.fieldErrors?.mjestoId?.[0] ? (
            <span className="mt-1 block text-xs normal-case tracking-normal text-rose-300">
              {state.fieldErrors.mjestoId[0]}
            </span>
          ) : null}
        </label>
      </div>

      {state.message ? (
        <div
          className={
            state.status === "success"
              ? "rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200"
              : state.status === "error"
                ? "rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
                : "rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
          }
        >
          {state.message}
        </div>
      ) : null}

      {state.inviteLink ? (
        <div className="rounded-xl border border-cyan-300/70 bg-cyan-50 p-3 dark:border-cyan-500/30 dark:bg-cyan-500/10">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-800 dark:text-cyan-200">
            Invite link (vrijedi 24h)
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <a
              href={state.inviteLink}
              className="min-w-0 flex-1 break-all rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 transition hover:text-cyan-700 dark:border-border dark:bg-slate-950/65 dark:text-slate-100 dark:hover:text-cyan-200"
            >
              {state.inviteLink}
            </a>
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-cyan-300/60 bg-cyan-100 px-3 text-xs font-semibold text-cyan-900 transition hover:bg-cyan-200"
            >
              {isCopied ? <Check size={13} /> : <Copy size={13} />}
              {isCopied ? "Kopirano" : "Kopiraj"}
            </button>
          </div>
        </div>
      ) : null}

      {!hasRequiredContext ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Nedostaju lookup podaci (uloge ili lokacije). Forma je privremeno onemogućena.
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center rounded-xl border border-border bg-slate-900/70 px-4 text-sm text-slate-200 transition hover:border-slate-600"
          >
            Zatvori
          </button>
        ) : null}

        <button
          type="submit"
          disabled={isPending || !hasRequiredContext}
          className="inline-flex h-10 items-center rounded-xl border border-cyan-300 bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Spremanje..." : "Dodaj zaposlenika"}
        </button>
      </div>
    </form>
  );
}
