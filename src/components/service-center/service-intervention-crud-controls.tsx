"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, RotateCcw, Trash2, X } from "lucide-react";

import { INITIAL_ACTION_STATE } from "@/lib/actions/action-state";
import {
  deleteServiceInterventionAction,
  restoreServiceInterventionAction,
  updateServiceInterventionAction,
} from "@/lib/actions/fault-actions";
import type { ServiceTimelineItem } from "@/lib/fleet/operations-service";

interface SelectOption {
  id: number;
  label: string;
  plate?: string;
}

interface ServiceInterventionCrudControlsProps {
  service: ServiceTimelineItem;
  vehicleOptions: SelectOption[];
  categoryOptions: SelectOption[];
}

const PRIORITY_OPTIONS = [
  { value: "nisko", label: "Nisko" },
  { value: "srednje", label: "Srednje" },
  { value: "visoko", label: "Visoko" },
  { value: "kriticno", label: "Kritično" },
] as const;

const STATUS_OPTIONS = [
  { value: "novo", label: "Novo" },
  { value: "u_obradi", label: "U obradi" },
  { value: "zatvoreno", label: "Zatvoreno" },
] as const;

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 16);
  }

  const timezoneOffsetMs = parsed.getTimezoneOffset() * 60 * 1000;
  return new Date(parsed.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function normalizeStatus(value: string | null | undefined) {
  if (value === "novo" || value === "u_obradi" || value === "zatvoreno") {
    return value;
  }

  if (value?.toLowerCase().includes("zat")) {
    return "zatvoreno";
  }

  if (value?.toLowerCase().includes("obr")) {
    return "u_obradi";
  }

  return "novo";
}

export function ServiceInterventionCrudControls({
  service,
  vehicleOptions,
  categoryOptions,
}: ServiceInterventionCrudControlsProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [state, action, isPending] = useActionState(
    updateServiceInterventionAction,
    INITIAL_ACTION_STATE,
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <span className="skeleton-shimmer h-8 w-8 animate-pulse rounded-lg border border-border bg-surface-elevated" />
        <span className="skeleton-shimmer h-8 w-8 animate-pulse rounded-lg border border-border bg-surface-elevated" />
      </div>
    );
  }

  if (service.deletedAtIso) {
    return (
      <form action={restoreServiceInterventionAction} className="inline-flex">
        <input type="hidden" name="interventionId" value={service.id} />
        <button
          type="submit"
          title="Vrati servisnu intervenciju"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-100 text-emerald-800 transition hover:bg-emerald-200 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-200"
        >
          <RotateCcw size={14} />
        </button>
      </form>
    );
  }

  return (
    <div className="inline-flex flex-wrap justify-end gap-1.5">
      <button
        type="button"
        onClick={() => setIsEditOpen(true)}
        title="Uredi servisnu intervenciju"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200"
      >
        <Pencil size={14} />
      </button>

      <form
        action={deleteServiceInterventionAction}
        onSubmit={(event) => {
          if (deleteReason.trim().length < 3) {
            event.preventDefault();
            setDeleteError("Razlog mora imati barem 3 znaka.");
            return;
          }

          setDeleteError("");
          setIsDeleteOpen(false);
        }}
        className="inline-flex"
      >
        <input type="hidden" name="interventionId" value={service.id} />
        <button
          type="button"
          title="Arhiviraj servisnu intervenciju"
          onClick={() => {
            setIsDeleteOpen(true);
            setDeleteError("");
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 bg-rose-100 text-rose-800 transition hover:bg-rose-200 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-200"
        >
          <Trash2 size={14} />
        </button>

        {isDeleteOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-4 sm:p-6">
            <button
              type="button"
              aria-label="Zatvori arhiviranje servisa"
              onClick={() => {
                setIsDeleteOpen(false);
                setDeleteError("");
              }}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            />

            <div className="relative w-full max-w-lg rounded-2xl border border-border bg-background p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.6),0_28px_80px_rgba(2,6,23,0.7)]">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-rose-300">Arhiviranje servisa</p>
                  <h3 className="mt-2 text-lg font-semibold text-foreground">Potvrdi brisanje</h3>
                  <p className="mt-1 text-sm text-muted">Unesi razlog arhiviranja servisne intervencije.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteOpen(false);
                    setDeleteError("");
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:border-cyan-500/45 hover:text-cyan-200"
                  aria-label="Zatvori popup"
                >
                  <X size={15} />
                </button>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-muted">Razlog</span>
                <textarea
                  name="razlogBrisanja"
                  value={deleteReason}
                  onChange={(event) => {
                    setDeleteReason(event.target.value);
                    if (deleteError) {
                      setDeleteError("");
                    }
                  }}
                  rows={4}
                  placeholder="Npr. Duplikat zapisa ili greška u unosu."
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-cyan-500/45"
                />
              </label>

              {deleteError ? <p className="mt-2 text-sm text-rose-300">{deleteError}</p> : null}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteOpen(false);
                    setDeleteError("");
                  }}
                  className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-xs font-semibold uppercase tracking-[0.12em] text-foreground transition hover:border-cyan-500/45 hover:text-cyan-200"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center rounded-lg border border-rose-300 bg-rose-100 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-rose-800 transition hover:bg-rose-200 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-200"
                >
                  Potvrdi brisanje
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </form>

      {isEditOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-4 sm:p-6">
          <button
            type="button"
            aria-label="Zatvori uređivanje servisa"
            onClick={() => setIsEditOpen(false)}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          />

          <div className="relative max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl border border-border bg-background p-4 shadow-[0_28px_80px_rgba(2,6,23,0.7)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Servisna intervencija</p>
                <h3 className="mt-1 text-lg font-semibold text-foreground">Uredi zapis #{service.id}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:border-cyan-500/45 hover:text-cyan-200"
                aria-label="Zatvori"
              >
                <X size={15} />
              </button>
            </div>

            <form action={action} className="grid gap-3">
              <input type="hidden" name="interventionId" value={service.id} />

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted">
                  Vozilo
                  <select
                    name="voziloId"
                    defaultValue={service.vehicleId ?? ""}
                    required
                    className="carlytics-select h-10 rounded-lg px-3 text-sm normal-case tracking-normal"
                  >
                    <option value="">Odaberi vozilo</option>
                    {vehicleOptions.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.label} {vehicle.plate ? `(${vehicle.plate})` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted">
                  Kategorija
                  <select
                    name="kategorijaId"
                    defaultValue={service.categoryId ?? ""}
                    className="carlytics-select h-10 rounded-lg px-3 text-sm normal-case tracking-normal"
                  >
                    <option value="">Nekategorizirano</option>
                    {categoryOptions.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted">
                  Hitnost
                  <select
                    name="hitnost"
                    defaultValue={service.priority ?? "srednje"}
                    className="carlytics-select h-10 rounded-lg px-3 text-sm normal-case tracking-normal"
                  >
                    {PRIORITY_OPTIONS.map((priority) => (
                      <option key={priority.value} value={priority.value}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted">
                  Status
                  <select
                    name="statusPrijave"
                    defaultValue={normalizeStatus(service.statusRaw)}
                    className="carlytics-select h-10 rounded-lg px-3 text-sm normal-case tracking-normal"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted">
                  Datum početka
                  <input
                    type="datetime-local"
                    name="datumPocetka"
                    defaultValue={toDateTimeLocal(service.startedAtIso)}
                    required
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-cyan-500/45"
                  />
                </label>

                <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted">
                  Datum završetka
                  <input
                    type="datetime-local"
                    name="datumZavrsetka"
                    defaultValue={toDateTimeLocal(service.endedAtIso)}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-cyan-500/45"
                  />
                </label>

                <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted">
                  Kilometraža
                  <input
                    type="number"
                    name="kmUTomTrenutku"
                    min="0"
                    step="1"
                    defaultValue={service.kmAtMoment}
                    required
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-cyan-500/45"
                  />
                </label>

                <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted">
                  Cijena
                  <input
                    type="number"
                    name="cijena"
                    min="0"
                    step="0.01"
                    defaultValue={service.cost}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-cyan-500/45"
                  />
                </label>
              </div>

              <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted">
                Opis
                <textarea
                  name="opis"
                  defaultValue={service.description}
                  rows={4}
                  required
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-cyan-500/45"
                />
              </label>

              {state.message ? (
                <p className={state.status === "success" ? "text-sm text-emerald-300" : "text-sm text-rose-300"}>
                  {state.message}
                </p>
              ) : null}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-xs font-semibold uppercase tracking-[0.12em] text-foreground transition hover:border-cyan-500/45 hover:text-cyan-200"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex h-9 items-center rounded-lg border border-cyan-300 bg-cyan-400 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isPending ? "Spremam..." : "Spremi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
