import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  Fuel,
  Gauge,
  TriangleAlert,
  UserRound,
  Wrench,
} from "lucide-react";
import { notFound } from "next/navigation";

import { FallbackChip } from "@/components/dashboard/fallback-chip";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import type { FaultQueueItem } from "@/lib/fleet/operations-service";
import type { VehicleListItem } from "@/lib/fleet/types";
import { getVehicleDigitalTwinData } from "@/lib/fleet/vehicle-digital-twin-service";

interface VehicleDetailPageProps {
  params: Promise<{ id: string }>;
}

function parseVehicleId(rawId: string) {
  const parsed = Number(rawId);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function formatDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

function formatDateTime(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function formatAmount(value: number) {
  return value.toLocaleString("hr-HR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatServiceDue(serviceDueKm: number) {
  if (serviceDueKm > 0) {
    return `${serviceDueKm.toLocaleString("hr-HR")} km`;
  }

  if (serviceDueKm === 0) {
    return "servis je sada potreban";
  }

  return `+${Math.abs(serviceDueKm).toLocaleString("hr-HR")} km`;
}

function getVehicleStatusVariant(status: VehicleListItem["status"]) {
  if (status === "Na servisu") {
    return "warning" as const;
  }

  if (status === "Zauzeto") {
    return "info" as const;
  }

  return "success" as const;
}

function getFaultPriorityVariant(priority: FaultQueueItem["priority"]) {
  if (priority === "kriticno") {
    return "danger" as const;
  }

  if (priority === "visoko") {
    return "warning" as const;
  }

  if (priority === "nisko") {
    return "info" as const;
  }

  return "neutral" as const;
}

function getFaultPriorityLabel(priority: FaultQueueItem["priority"]) {
  if (priority === "kriticno") {
    return "Kritično";
  }

  if (priority === "visoko") {
    return "Visoko";
  }

  if (priority === "nisko") {
    return "Nisko";
  }

  return "Srednje";
}

function getFaultStatusVariant(statusLabel: string) {
  const normalized = statusLabel.toLowerCase();

  if (normalized.includes("zat")) {
    return "success" as const;
  }

  if (normalized.includes("obr")) {
    return "warning" as const;
  }

  return "danger" as const;
}

function getRegistrationBadge(registrationExpiryDays: number | null) {
  if (registrationExpiryDays === null) {
    return {
      label: "Registracija: nema podataka",
      variant: "neutral" as const,
    };
  }

  if (registrationExpiryDays < 0) {
    return {
      label: `Registracija istekla prije ${Math.abs(registrationExpiryDays)} dana`,
      variant: "danger" as const,
    };
  }

  if (registrationExpiryDays <= 10) {
    return {
      label: `Registracija ističe za ${registrationExpiryDays} dana`,
      variant: "warning" as const,
    };
  }

  return {
    label: `Registracija vrijedi još ${registrationExpiryDays} dana`,
    variant: "success" as const,
  };
}

export default async function FlotaVehicleDetailPage({ params }: VehicleDetailPageProps) {
  const { id } = await params;
  const vehicleId = parseVehicleId(id);

  if (!vehicleId) {
    notFound();
  }

  const digitalTwinData = await getVehicleDigitalTwinData(vehicleId);

  if (!digitalTwinData.vehicle) {
    notFound();
  }

  const vehicle = digitalTwinData.vehicle;
  const openFaultCount = digitalTwinData.faultHistory.filter((fault) => fault.isOpen).length;
  const openServiceCount = digitalTwinData.serviceHistory.filter((service) => service.isOpen).length;
  const isServiceUrgent = vehicle.serviceDueKm <= 500;
  const serviceProgress = Math.max(
    0,
    Math.min(100, ((vehicle.serviceDueKm > 0 ? vehicle.serviceDueKm : 0) / 15000) * 100),
  );

  const registrationState = getRegistrationBadge(vehicle.registrationExpiryDays);

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${vehicle.make} ${vehicle.model}`}
        description="Digital twin vozila s operativnim snapshotom i poviješću kvarova, goriva te servisnih intervencija."
        actions={
          <>
            <FallbackChip isUsingFallbackData={digitalTwinData.isUsingFallbackData} />
            <Link
              href="/flota"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200"
            >
              <ArrowLeft size={15} />
              Natrag na flotu
            </Link>
          </>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Identitet vozila</p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-slate-100">
                {vehicle.make} {vehicle.model}
              </p>
              <p className="data-font mt-2 inline-flex rounded-lg border border-border bg-surface px-2 py-1 text-xs text-foreground">
                {vehicle.plate}
              </p>
            </div>
            <Badge variant={getVehicleStatusVariant(vehicle.status)}>{vehicle.status}</Badge>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Kilometraža</p>
              <p className="data-font mt-2 text-lg text-slate-100">
                {vehicle.km.toLocaleString("hr-HR")} km
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Kapacitet rezervoara</p>
              <p className="data-font mt-2 text-lg text-slate-100">{vehicle.fuelCapacity} L</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Otvoreni kvarovi</p>
              <p className="data-font mt-2 text-lg text-amber-300">{openFaultCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Otvoreni servisi</p>
              <p className="data-font mt-2 text-lg text-sky-300">{openServiceCount}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant={registrationState.variant}>{registrationState.label}</Badge>
            {digitalTwinData.activeAssignment ? (
              <Badge variant="info">
                Aktivno zaduženje: {digitalTwinData.activeAssignment.employeeName}
              </Badge>
            ) : (
              <Badge variant="neutral">Nema aktivnog zaduženja</Badge>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                Servisni rizik
              </h2>
              <p className="mt-2 text-sm text-muted">
                Preostali interval do malog servisa i trenutni rizik od prekoračenja.
              </p>
            </div>
            <Wrench className={isServiceUrgent ? "text-rose-300" : "text-cyan-300"} size={18} />
          </div>

          <div className="mt-6 rounded-xl border border-border bg-surface p-4">
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.18em]">
              <span className="text-muted">Servis za</span>
              <span className={isServiceUrgent ? "text-rose-300" : "text-slate-200"}>
                {formatServiceDue(vehicle.serviceDueKm)}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className={isServiceUrgent ? "h-full bg-rose-500" : "h-full bg-cyan-500"}
                style={{ width: `${serviceProgress}%` }}
              />
            </div>
          </div>

          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
              <dt className="flex items-center gap-2 text-muted">
                <Gauge size={14} />
                Trenutna km
              </dt>
              <dd className="data-font text-slate-100">{vehicle.km.toLocaleString("hr-HR")}</dd>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
              <dt className="flex items-center gap-2 text-muted">
                <TriangleAlert size={14} />
                Aktivni kvarovi
              </dt>
              <dd className="data-font text-amber-300">{openFaultCount}</dd>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
              <dt className="flex items-center gap-2 text-muted">
                <UserRound size={14} />
                Aktivno zaduženje
              </dt>
              <dd className="text-right text-slate-200">
                {digitalTwinData.activeAssignment
                  ? digitalTwinData.activeAssignment.employeeName
                  : "Nije aktivno"}
              </dd>
            </div>
          </dl>
        </Card>
      </section>

      <section className="grid gap-5 2xl:grid-cols-3">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
              Povijest kvarova
            </h2>
            <Badge variant={openFaultCount > 0 ? "warning" : "success"}>Ukupno: {digitalTwinData.faultHistory.length}</Badge>
          </div>

          {digitalTwinData.faultHistory.length === 0 ? (
            <p className="text-sm text-muted">Nema prijava kvarova za odabrano vozilo.</p>
          ) : (
            <ul className="space-y-3">
              {digitalTwinData.faultHistory.slice(0, 12).map((fault) => (
                <li key={fault.id} className="rounded-xl border border-border bg-surface px-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-100">{fault.description}</p>
                    <div className="flex gap-2">
                      <Badge variant={getFaultPriorityVariant(fault.priority)}>
                        {getFaultPriorityLabel(fault.priority)}
                      </Badge>
                      <Badge variant={getFaultStatusVariant(fault.statusLabel)}>{fault.statusLabel}</Badge>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    Prijavio: {fault.reporterName} • {formatDateTime(fault.reportedAtIso)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
              Povijest goriva
            </h2>
            <Badge variant="info">Zapisa: {digitalTwinData.fuelHistory.length}</Badge>
          </div>

          {digitalTwinData.fuelHistory.length === 0 ? (
            <p className="text-sm text-muted">Nema unosa goriva za odabrano vozilo.</p>
          ) : (
            <ul className="space-y-3">
              {digitalTwinData.fuelHistory.slice(0, 14).map((entry) => (
                <li key={entry.id} className="rounded-xl border border-border bg-surface px-3 py-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-100">{formatDateTime(entry.dateIso)}</p>
                      <p className="mt-1 text-xs text-muted">Zaposlenik: {entry.employeeName}</p>
                    </div>
                    <Fuel size={16} className="text-cyan-300" />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <p className="text-muted">KM: <span className="data-font text-slate-200">{entry.kmAtFill.toLocaleString("hr-HR")}</span></p>
                    <p className="text-muted">Litraža: <span className="data-font text-slate-200">{formatAmount(entry.liters)} L</span></p>
                    <p className="text-muted">EUR/L: <span className="data-font text-slate-200">{formatAmount(entry.pricePerLiter)}</span></p>
                    <p className="text-muted">Ukupno: <span className="data-font text-amber-200">{formatAmount(entry.totalAmount)} EUR</span></p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
              Servisna povijest
            </h2>
            <Badge variant={openServiceCount > 0 ? "warning" : "success"}>Stavki: {digitalTwinData.serviceHistory.length}</Badge>
          </div>

          {digitalTwinData.serviceHistory.length === 0 ? (
            <p className="text-sm text-muted">Nema servisnih intervencija za odabrano vozilo.</p>
          ) : (
            <ul className="space-y-3">
              {digitalTwinData.serviceHistory.slice(0, 12).map((service) => (
                <li key={service.id} className="rounded-xl border border-border bg-surface px-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-100">{service.description}</p>
                    <Badge variant={service.isOpen ? "warning" : "success"}>
                      {service.isOpen ? "U tijeku" : "Završeno"}
                    </Badge>
                  </div>
                  <p className="mt-2 flex items-center gap-2 text-xs text-muted">
                    <CalendarClock size={13} />
                    {formatDate(service.startedAtIso)}
                    {service.endedAtIso ? ` - ${formatDate(service.endedAtIso)}` : " - u tijeku"}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted">
                    <span>
                      KM: <span className="data-font text-slate-200">{service.kmAtMoment.toLocaleString("hr-HR")}</span>
                    </span>
                    <span>
                      Cijena: <span className="data-font text-amber-200">{formatAmount(service.cost)} EUR</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
