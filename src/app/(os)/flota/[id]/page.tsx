import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  Fuel,
  Gauge,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { notFound } from "next/navigation";

import { FallbackChip } from "@/components/dashboard/fallback-chip";
import { VehicleCostBreakdownChart } from "@/components/fleet/vehicle-cost-breakdown-chart";
import { VehicleActivationControls } from "@/components/fleet/vehicle-activation-controls";
import { RegistrationExtensionForm } from "@/components/fleet/registration-extension-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ServerPagination } from "@/components/ui/server-pagination";
import type { FaultQueueItem } from "@/lib/fleet/operations-service";
import type { VehicleListItem } from "@/lib/fleet/types";
import { getVehicleDigitalTwinData } from "@/lib/fleet/vehicle-digital-twin-service";
import { formatDate, formatDateTime } from "@/lib/utils/date-format";
import { parsePageParam } from "@/lib/utils/page-params";

interface VehicleDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ gume?: string; registracije?: string }>;
}

const MAX_DETAIL_ITEMS = 3;
const TIRE_ITEMS_PER_PAGE = 5;
const REGISTRATION_ITEMS_PER_PAGE = 5;

function parseVehicleId(rawId: string) {
  const parsed = Number(rawId);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function formatAmount(value: number) {
  return value.toLocaleString("hr-HR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCurrency(value: number | null) {
  if (value === null) {
    return "N/A";
  }

  return `${formatAmount(value)} EUR`;
}

function formatServiceSnapshot(dateIso: string | null, km: number | null) {
  if (!dateIso && km === null) {
    return "Nema podataka";
  }

  const datePart = dateIso ? formatDate(dateIso) : "N/A";
  const kmPart = km !== null ? `${km.toLocaleString("hr-HR")} km` : "N/A";

  return `${datePart} • ${kmPart}`;
}

function formatServiceDueKm(value: number) {
  if (value < 0) {
    return `Kasni ${Math.abs(value).toLocaleString("hr-HR")} km`;
  }

  return `${value.toLocaleString("hr-HR")} km`;
}

function getServiceProgressPercent(params: {
  currentKm: number;
  lastServiceKm: number | null;
  dueKm: number;
  fallbackIntervalKm: number;
}) {
  const traveledSinceService = params.lastServiceKm === null
    ? null
    : Math.max(0, params.currentKm - params.lastServiceKm);

  const resolvedIntervalKm = traveledSinceService === null
    ? params.fallbackIntervalKm
    : traveledSinceService + params.dueKm;

  const safeIntervalKm = Math.max(1, resolvedIntervalKm);
  const safeDueKm = Math.max(0, params.dueKm);

  return Math.max(0, Math.min(100, (safeDueKm / safeIntervalKm) * 100));
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

  if (
    normalized.includes("zat") ||
    normalized.includes("rije") ||
    normalized.includes("rijes") ||
    normalized.includes("closed") ||
    normalized.includes("res")
  ) {
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

function getRegistrationHistoryStatus(expiryDateIso: string, isLatestRecord: boolean) {
  // Status prikazujemo samo za najnoviji zapis registracije.
  // Ako je registracija obnovljena, stariji zapisi ostaju bez statusnih pilula.
  if (!isLatestRecord) {
    return null;
  }

  const expiryDate = new Date(expiryDateIso);

  if (Number.isNaN(expiryDate.getTime())) {
    return {
      label: "Status nepoznat",
      variant: "neutral" as const,
    };
  }

  const now = new Date();
  const midnightNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const midnightExpiry = new Date(
    expiryDate.getFullYear(),
    expiryDate.getMonth(),
    expiryDate.getDate(),
  );

  const daysUntilExpiry = Math.ceil(
    (midnightExpiry.getTime() - midnightNow.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysUntilExpiry < 0) {
    return {
      label: `Istekla prije ${Math.abs(daysUntilExpiry)} dana`,
      variant: "danger" as const,
    };
  }

  if (daysUntilExpiry <= 30) {
    return {
      label: `Ističe za ${daysUntilExpiry} dana`,
      variant: "warning" as const,
    };
  }

  return {
    label: `Aktivna još ${daysUntilExpiry} dana`,
    variant: "success" as const,
  };
}

function buildVehicleDetailHref(params: {
  vehicleId: number;
  tirePage: number;
  registrationPage: number;
}) {
  const query = new URLSearchParams();

  if (params.tirePage > 1) {
    query.set("gume", String(params.tirePage));
  }

  if (params.registrationPage > 1) {
    query.set("registracije", String(params.registrationPage));
  }

  const queryString = query.toString();
  return queryString ? `/flota/${params.vehicleId}?${queryString}` : `/flota/${params.vehicleId}`;
}

export default async function FlotaVehicleDetailPage({ params, searchParams }: VehicleDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedTirePage = parsePageParam(resolvedSearchParams?.gume);
  const requestedRegistrationPage = parsePageParam(resolvedSearchParams?.registracije);
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
  const unifiedServiceHistory = [
    ...digitalTwinData.serviceHistory.map((service) => ({
      type: "service" as const,
      sortAtIso: service.endedAtIso ?? service.startedAtIso,
      payload: service,
      isOpen: service.isOpen,
    })),
    ...digitalTwinData.faultHistory
      .filter((fault) => fault.isOpen)
      .map((fault) => ({
        type: "fault" as const,
        sortAtIso: fault.reportedAtIso,
        payload: fault,
        isOpen: fault.isOpen,
      })),
  ].sort((left, right) => {
    const leftTime = new Date(left.sortAtIso).getTime();
    const rightTime = new Date(right.sortAtIso).getTime();

    const safeLeftTime = Number.isNaN(leftTime) ? 0 : leftTime;
    const safeRightTime = Number.isNaN(rightTime) ? 0 : rightTime;
    return safeRightTime - safeLeftTime;
  });
  const openUnifiedServiceCount = unifiedServiceHistory.filter((item) => item.isOpen).length;
  const isServiceUrgent = vehicle.serviceDueKm <= 2000;
  const smallServiceProgress = getServiceProgressPercent({
    currentKm: vehicle.km,
    lastServiceKm: vehicle.lastSmallServiceKm,
    dueKm: vehicle.smallServiceDueKm,
    fallbackIntervalKm: vehicle.serviceProgressIntervalKm,
  });
  const largeServiceProgress = getServiceProgressPercent({
    currentKm: vehicle.km,
    lastServiceKm: vehicle.lastLargeServiceKm,
    dueKm: vehicle.largeServiceDueKm,
    fallbackIntervalKm: vehicle.serviceProgressIntervalKm,
  });

  const registrationState = getRegistrationBadge(vehicle.registrationExpiryDays);
  const shouldShowRegistrationBadge = vehicle.isActive || registrationState.variant !== "success";

  const totalTirePages = Math.max(
    1,
    Math.ceil(digitalTwinData.tireHistory.length / TIRE_ITEMS_PER_PAGE),
  );
  const safeTirePage = Math.min(requestedTirePage, totalTirePages);
  const pagedTireHistory = digitalTwinData.tireHistory.slice(
    (safeTirePage - 1) * TIRE_ITEMS_PER_PAGE,
    safeTirePage * TIRE_ITEMS_PER_PAGE,
  );

  const sortedRegistrationHistory = [...digitalTwinData.registrationHistory].sort((left, right) => {
    const leftTime = new Date(left.registrationDateIso).getTime();
    const rightTime = new Date(right.registrationDateIso).getTime();
    const safeLeftTime = Number.isNaN(leftTime) ? 0 : leftTime;
    const safeRightTime = Number.isNaN(rightTime) ? 0 : rightTime;

    return safeRightTime - safeLeftTime;
  });

  const totalRegistrationPages = Math.max(
    1,
    Math.ceil(sortedRegistrationHistory.length / REGISTRATION_ITEMS_PER_PAGE),
  );
  const safeRegistrationPage = Math.min(requestedRegistrationPage, totalRegistrationPages);
  const pagedRegistrationHistory = sortedRegistrationHistory.slice(
    (safeRegistrationPage - 1) * REGISTRATION_ITEMS_PER_PAGE,
    safeRegistrationPage * REGISTRATION_ITEMS_PER_PAGE,
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${vehicle.make} ${vehicle.model}`}
        description="Digital twin vozila s operativnim snapshotom, servisnom poviješću, gorivom i troškovima."
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

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Badge variant={getVehicleStatusVariant(vehicle.status)}>{vehicle.status}</Badge>
                <Badge variant={vehicle.isActive ? "success" : "danger"}>
                  {vehicle.isActive ? "Aktivno vozilo" : "Deaktivirano vozilo"}
                </Badge>
              </div>
              <div className="w-full sm:w-auto">
                <VehicleActivationControls vehicleId={vehicle.id} isActive={vehicle.isActive} />
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Tip goriva</p>
              <p className="data-font mt-2 text-lg text-slate-100">{vehicle.fuelTypeLabel ?? "Nije definirano"}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Broj šasije</p>
              <p className="data-font mt-2 text-sm text-slate-100">{vehicle.vin ?? "N/A"}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Godina proizvodnje</p>
              <p className="data-font mt-2 text-lg text-slate-100">{vehicle.productionYear ?? "N/A"}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Nabavna vrijednost</p>
              <p className="data-font mt-2 text-sm text-slate-100">{formatCurrency(vehicle.acquisitionValue)}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Grad registracije</p>
              <p className="data-font mt-2 text-sm text-slate-100">{vehicle.registrationCity ?? "N/A"}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {shouldShowRegistrationBadge ? (
              <Badge variant={registrationState.variant}>{registrationState.label}</Badge>
            ) : null}
            {digitalTwinData.activeAssignment ? (
              <Badge variant="info">
                Aktivno zaduženje: {digitalTwinData.activeAssignment.employeeName}
              </Badge>
            ) : vehicle.isActive ? (
              <Badge variant="neutral">Nema aktivnog zaduženja</Badge>
            ) : null}
            {!vehicle.isActive && vehicle.deactivationReason ? (
              <Badge variant="danger">Razlog deaktivacije: {vehicle.deactivationReason}</Badge>
            ) : null}
          </div>

          {vehicle.isActive &&
          vehicle.registrationExpiryDays !== null &&
          vehicle.registrationExpiryDays <= 30 ? (
            <RegistrationExtensionForm vehicleId={vehicle.id} />
          ) : null}
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                Servisni rizik
              </h2>
              <p className="mt-2 text-sm text-muted">
                Kombinirani prikaz malog i velikog servisa prema kilometraži i vremenskom intervalu.
              </p>
            </div>
            <Wrench className={isServiceUrgent ? "text-rose-300" : "text-cyan-300"} size={18} />
          </div>

          <div className="mt-6 space-y-3">
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.18em]">
                <span className="text-muted">Mali servis</span>
                <span className={vehicle.smallServiceDueKm <= 2000 ? "text-amber-300" : "text-slate-200"}>
                  {formatServiceDueKm(vehicle.smallServiceDueKm)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className={vehicle.smallServiceDueKm <= 2000 ? "h-full bg-amber-500" : "h-full bg-cyan-500"}
                  style={{ width: `${smallServiceProgress}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.18em]">
                <span className="text-muted">Veliki servis</span>
                <span className={vehicle.largeServiceDueKm <= 5000 ? "text-amber-300" : "text-slate-200"}>
                  {formatServiceDueKm(vehicle.largeServiceDueKm)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className={vehicle.largeServiceDueKm <= 5000 ? "h-full bg-amber-500" : "h-full bg-cyan-500"}
                  style={{ width: `${largeServiceProgress}%` }}
                />
              </div>
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
              <dt className="text-muted">Zadnji mali servis</dt>
              <dd className="text-right text-slate-200">
                {formatServiceSnapshot(vehicle.lastSmallServiceDate, vehicle.lastSmallServiceKm)}
              </dd>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
              <dt className="text-muted">Zadnji veliki servis</dt>
              <dd className="text-right text-slate-200">
                {formatServiceSnapshot(vehicle.lastLargeServiceDate, vehicle.lastLargeServiceKm)}
              </dd>
            </div>
          </dl>
        </Card>
      </section>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
            Troškovi po vozilu
          </h2>
          <Badge variant="info">Zadnjih 6 mjeseci</Badge>
        </div>
        <VehicleCostBreakdownChart series={digitalTwinData.costBreakdownSeries} />
      </Card>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
              Servisna povijest
            </h2>
            <Badge variant={openUnifiedServiceCount > 0 ? "warning" : "success"}>
              Stavki: {unifiedServiceHistory.length}
            </Badge>
          </div>

          {unifiedServiceHistory.length === 0 ? (
            <p className="text-sm text-muted">Nema servisnih stavki za odabrano vozilo.</p>
          ) : (
            <ul className="space-y-3">
              {unifiedServiceHistory.slice(0, MAX_DETAIL_ITEMS).map((historyItem) => {
                if (historyItem.type === "service") {
                  const service = historyItem.payload;

                  return (
                    <li key={`service-${service.id}`} className="rounded-xl border border-border bg-surface px-3 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-100">{service.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {service.categoryLabel ? <Badge variant="neutral">{service.categoryLabel}</Badge> : null}
                          <Badge variant={service.isOpen ? "warning" : "success"}>
                            {service.isOpen ? "U tijeku" : "Završeno"}
                          </Badge>
                        </div>
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
                  );
                }

                const fault = historyItem.payload;

                return (
                  <li key={`fault-${fault.id}`} className="rounded-xl border border-border bg-surface px-3 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-100">{fault.description}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="neutral">Prijava kvara</Badge>
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
                );
              })}
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
              {digitalTwinData.fuelHistory.slice(0, MAX_DETAIL_ITEMS).map((entry) => (
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
                    <p className="text-muted">Gorivo: <span className="text-slate-200">{entry.fuelTypeLabel ?? "N/A"}</span></p>
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
              Evidencija guma
            </h2>
            <Badge variant="info">Zapisa: {digitalTwinData.tireHistory.length}</Badge>
          </div>

          {digitalTwinData.tireHistory.length === 0 ? (
            <p className="text-sm text-muted">Nema evidentiranih kupovina guma za ovo vozilo.</p>
          ) : (
            <>
              <ul className="space-y-3">
                {pagedTireHistory.map((tireEntry) => (
                <li key={tireEntry.id} className="rounded-xl border border-border bg-surface px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-100">
                      {tireEntry.manufacturer ?? "Nepoznat proizvođač"}
                    </p>
                    <div className="flex gap-2">
                      <Badge variant="neutral">{tireEntry.season ?? "Sezona N/A"}</Badge>
                      {tireEntry.cost !== null ? (
                        <Badge variant="warning">{formatAmount(tireEntry.cost)} EUR</Badge>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    Datum kupovine: {tireEntry.purchaseDateIso ? formatDate(tireEntry.purchaseDateIso) : "N/A"}
                  </p>
                </li>
                ))}
              </ul>

              <ServerPagination
                currentPage={safeTirePage}
                totalPages={totalTirePages}
                hrefForPage={(page) =>
                  buildVehicleDetailHref({
                    vehicleId: vehicle.id,
                    tirePage: page,
                    registrationPage: safeRegistrationPage,
                  })
                }
              />
            </>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
              Povijest registracija
            </h2>
            <Badge variant="info">Zapisa: {digitalTwinData.registrationHistory.length}</Badge>
          </div>

          {digitalTwinData.registrationHistory.length === 0 ? (
            <p className="text-sm text-muted">Nema evidentiranih registracija za ovo vozilo.</p>
          ) : (
            <>
              <ul className="space-y-3">
                {pagedRegistrationHistory.map((registration, index) => {
                const absoluteIndex = (safeRegistrationPage - 1) * REGISTRATION_ITEMS_PER_PAGE + index;
                const registrationStatus = getRegistrationHistoryStatus(
                  registration.expiryDateIso,
                  absoluteIndex === 0,
                );

                return (
                  <li
                    key={registration.id}
                    className="rounded-xl border border-border bg-surface px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-100">
                        {registration.registrationPlate}
                      </p>
                      {registrationStatus ? (
                        <Badge variant={registrationStatus.variant}>{registrationStatus.label}</Badge>
                      ) : null}
                    </div>

                    <div className="mt-2 grid gap-1 text-xs text-muted">
                      <p>
                        Datum registracije:{" "}
                        <span className="text-slate-200">
                          {formatDate(registration.registrationDateIso)}
                        </span>
                      </p>
                      <p>
                        Datum isteka:{" "}
                        <span className="text-slate-200">
                          {formatDate(registration.expiryDateIso)}
                        </span>
                      </p>
                      <p>
                        Cijena:{" "}
                        <span className="data-font text-amber-200">
                          {registration.cost === null
                            ? "N/A"
                            : `${formatAmount(registration.cost)} EUR`}
                        </span>
                      </p>
                    </div>
                  </li>
                );
              })}
              </ul>

              <ServerPagination
                currentPage={safeRegistrationPage}
                totalPages={totalRegistrationPages}
                hrefForPage={(page) =>
                  buildVehicleDetailHref({
                    vehicleId: vehicle.id,
                    tirePage: safeTirePage,
                    registrationPage: page,
                  })
                }
              />
            </>
          )}
        </Card>
      </section>
    </div>
  );
}
