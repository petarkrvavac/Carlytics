import Link from "next/link";
import { Wrench } from "lucide-react";

import type { VehicleListItem } from "@/lib/fleet/types";
import { cn } from "@/lib/utils/cn";

interface VehicleStatusCardProps {
  vehicle: VehicleListItem;
}

function StatusBadge({ status }: Pick<VehicleListItem, "status">) {
  const variants = {
    Slobodno:
      "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-300",
    Zauzeto:
      "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-500/35 dark:bg-sky-500/15 dark:text-sky-300",
    "Na servisu":
      "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-300",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
        variants[status],
      )}
    >
      {status}
    </span>
  );
}

function ServiceDueLabel({ serviceDueLabel }: Pick<VehicleListItem, "serviceDueLabel">) {
  return <span>{serviceDueLabel}</span>;
}

function getRegistrationState(registrationExpiryDays: number | null) {
  if (registrationExpiryDays === null) {
    return null;
  }

  if (registrationExpiryDays < 0) {
    return {
      label: `Registracija istekla prije ${Math.abs(registrationExpiryDays)} dana`,
      className:
        "border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-200",
    };
  }

  if (registrationExpiryDays <= 30) {
    return {
      label: `Registracija istječe za ${registrationExpiryDays} dana`,
      className:
        "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-200",
    };
  }

  return null;
}

export function VehicleStatusCard({ vehicle }: VehicleStatusCardProps) {
  const isServiceUrgent = vehicle.serviceDueKm <= 2000;
  const hasOpenFault = vehicle.openFaultCount > 0;
  const isInactive = !vehicle.isActive;
  const registrationState = getRegistrationState(vehicle.registrationExpiryDays);
  const progress = Math.max(
    0,
    Math.min(
      100,
      ((vehicle.serviceDueKm > 0 ? vehicle.serviceDueKm : 0) /
        Math.max(1, vehicle.serviceProgressIntervalKm)) *
        100,
    ),
  );

  return (
    <Link
      href={`/flota/${vehicle.id}`}
      className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
    >
      <article
        className={cn(
          "group flex h-full flex-col rounded-2xl border bg-white p-5 transition-all duration-300 dark:bg-slate-900/92",
          isInactive
            ? "border-slate-300 bg-slate-100/80 opacity-90 dark:border-slate-700/80 dark:bg-slate-900/75"
            : hasOpenFault
            ? "border-amber-300 shadow-[0_0_0_1px_rgba(245,158,11,0.2),0_12px_28px_rgba(2,132,199,0.14)] dark:border-amber-500/50 dark:shadow-[0_0_0_1px_rgba(245,158,11,0.25),0_14px_34px_rgba(2,6,23,0.45)]"
            : "border-slate-200 hover:border-cyan-500/45 hover:shadow-[0_0_0_1px_rgba(6,182,212,0.22),0_12px_28px_rgba(2,132,199,0.14)] dark:border-slate-800/80 dark:hover:shadow-[0_0_0_1px_rgba(6,182,212,0.25),0_14px_34px_rgba(2,6,23,0.45)]",
        )}
      >
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-400">
              {vehicle.make}
            </h3>
            <p className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-white">{vehicle.model}</p>
            <span className="data-font mt-2 inline-block rounded border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-semibold text-sky-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {vehicle.plate}
            </span>
          </div>

          <div className="ml-2 flex shrink-0 flex-col items-end gap-2">
            <StatusBadge status={vehicle.status} />
            {isInactive ? (
              <span className="inline-flex items-center rounded-full border border-rose-300 bg-rose-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-900 dark:border-rose-500/35 dark:bg-rose-500/14 dark:text-rose-200">
                Neaktivno vozilo
              </span>
            ) : null}
            {hasOpenFault ? (
              <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:border-amber-500/35 dark:bg-amber-500/14 dark:text-amber-200">
                Aktivan kvar ({vehicle.openFaultCount})
              </span>
            ) : null}
            {registrationState ? (
              <span
                title={registrationState.label}
                className={cn(
                  "inline-flex max-w-62 items-center self-end overflow-hidden whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide",
                  registrationState.className,
                )}
              >
                <span className="truncate">{registrationState.label}</span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Kilometraža</p>
            <p className="data-font text-sm text-slate-800 dark:text-slate-200">
              {vehicle.km.toLocaleString("hr-HR")} km
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Gorivo</p>
            <p className="text-sm text-slate-800 dark:text-slate-200">
              {vehicle.fuelTypeLabel ?? "Nije definirano"}
            </p>
          </div>
        </div>

        <div
          className={cn(
            "mt-auto flex items-center gap-3 rounded-xl border p-3",
            isServiceUrgent
              ? "border-rose-500/30 bg-rose-500/10"
              : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/60",
          )}
        >
          <Wrench
            size={16}
            className={
              isServiceUrgent ? "text-rose-500 dark:text-rose-400" : "text-slate-700 dark:text-slate-500"
            }
          />

          <div className="flex-1">
            <div className="mb-1 flex justify-between text-[10px]">
              <span className="text-slate-500">Servis za:</span>
              <span
                className={
                  isServiceUrgent
                    ? "font-bold text-rose-700 dark:text-rose-300"
                    : "text-slate-800 dark:text-slate-300"
                }
              >
                <ServiceDueLabel serviceDueLabel={vehicle.serviceDueLabel} />
              </span>
            </div>

            <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={cn(
                  "h-full transition-all duration-500",
                  isServiceUrgent ? "bg-rose-500" : "bg-cyan-500",
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
