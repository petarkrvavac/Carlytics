"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";

import { updateVehicleActivationAction } from "@/lib/actions/vehicle-actions";
import { cn } from "@/lib/utils/cn";

interface VehicleActivationControlsProps {
  vehicleId: number;
  isActive: boolean;
}

export function VehicleActivationControls({
  vehicleId,
  isActive,
}: VehicleActivationControlsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const reasonInputId = useId();

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

  function submitVehicleDeactivation() {
    const normalizedReason = reason.trim();

    if (normalizedReason.length < 3) {
      setReasonError("Razlog deaktivacije mora imati barem 3 znaka.");
      return;
    }

    const form = formRef.current;
    const reasonInput = form?.elements.namedItem("razlogDeaktivacije") as HTMLInputElement | null;

    if (reasonInput) {
      reasonInput.value = normalizedReason;
    }

    setIsModalOpen(false);
    setReason("");
    setReasonError("");
    form?.requestSubmit();
  }

  return (
    <>
      <form ref={formRef} action={updateVehicleActivationAction}>
        <input type="hidden" name="vehicleId" value={vehicleId} />
        <input type="hidden" name="isAktivan" value={isActive ? "false" : "true"} />
        <input id={reasonInputId} type="hidden" name="razlogDeaktivacije" defaultValue="" />

        {isActive ? (
          <button
            type="button"
            onClick={() => {
              setReason("");
              setReasonError("");
              setIsModalOpen(true);
            }}
            className={cn(
              "inline-flex h-9 items-center rounded-lg border px-3 text-xs font-semibold uppercase tracking-[0.12em] transition",
              "border-rose-300 bg-rose-100 text-rose-800 hover:bg-rose-200 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-200",
            )}
          >
            Deaktiviraj vozilo
          </button>
        ) : (
          <button
            type="submit"
            className={cn(
              "inline-flex h-9 items-center rounded-lg border px-3 text-xs font-semibold uppercase tracking-[0.12em] transition",
              "border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-200",
            )}
          >
            Aktiviraj vozilo
          </button>
        )}
      </form>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-4 sm:p-6">
          <button
            type="button"
            onClick={() => {
              setIsModalOpen(false);
              setReasonError("");
            }}
            aria-label="Zatvori popup razloga deaktivacije"
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          />

          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-background p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.6),0_28px_80px_rgba(2,6,23,0.7)]">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Deaktivacija vozila</p>
                <h3 className="mt-2 text-lg font-semibold text-foreground">Unesi razlog deaktivacije</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setReasonError("");
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
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  if (reasonError) {
                    setReasonError("");
                  }
                }}
                rows={4}
                placeholder="Npr. Vozilo je povučeno iz upotrebe zbog većih troškova održavanja."
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-cyan-500/45"
              />
            </label>

            {reasonError ? <p className="mt-2 text-sm text-rose-300">{reasonError}</p> : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setReasonError("");
                }}
                className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-xs font-semibold uppercase tracking-[0.12em] text-foreground transition hover:border-cyan-500/45 hover:text-cyan-200"
              >
                Odustani
              </button>
              <button
                type="button"
                onClick={submitVehicleDeactivation}
                className="inline-flex h-9 items-center rounded-lg border border-rose-300 bg-rose-100 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-rose-800 transition hover:bg-rose-200 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-200"
              >
                Potvrdi deaktivaciju
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
