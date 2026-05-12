"use client";

import { useEffect, useState } from "react";
import { Pencil, X } from "lucide-react";

import { EditVehicleForm } from "@/components/fleet/edit-vehicle-form";
import type { VehicleListItem } from "@/lib/fleet/types";
import type { VehicleFormContext } from "@/lib/fleet/vehicle-form-context-service";

interface VehicleEditModalProps {
  vehicle: VehicleListItem;
  formContext: VehicleFormContext;
}

export function VehicleEditModal({ vehicle, formContext }: VehicleEditModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-cyan-300 bg-cyan-400 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-cyan-300"
      >
        <Pencil size={14} />
        Uredi vozilo
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-4 sm:p-6">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Zatvori popup uredivanja vozila"
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          />

          <div className="relative flex w-full max-w-4xl max-h-screen flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[0_0_0_1px_rgba(15,23,42,0.6),0_28px_80px_rgba(2,6,23,0.7)]">
            <div className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Uređivanje vozila</p>
                <h3 className="mt-2 text-lg font-semibold text-foreground">Ažuriraj podatke vozila</h3>
                <p className="mt-1 text-sm text-muted">
                  Administrativna izmjena osnovnih podataka, servisnih oznaka i statusa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:border-cyan-500/45 hover:text-cyan-200"
                aria-label="Zatvori popup"
              >
                <X size={15} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <EditVehicleForm vehicle={vehicle} formContext={formContext} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
