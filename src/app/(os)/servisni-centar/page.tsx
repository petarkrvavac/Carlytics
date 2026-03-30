import { Suspense } from "react";

import { FallbackChip } from "@/components/dashboard/fallback-chip";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  getServiceCenterHeaderData,
  getServiceCenterPriorityData,
  getServiceCenterTimelineData,
} from "@/lib/fleet/operations-service";

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

function getPriorityLabel(priority: string) {
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

function ServiceCenterHeaderFallback() {
  return (
    <header className="mb-8 flex flex-col gap-5 border-b border-border/70 pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2.5">
        <div className="skeleton-shimmer h-8 w-56 animate-pulse rounded-lg bg-surface-elevated" />
        <div className="skeleton-shimmer h-4 w-full max-w-2xl animate-pulse rounded-md bg-surface-elevated" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="skeleton-shimmer h-10 w-40 animate-pulse rounded-xl bg-surface-elevated" />
        <div className="skeleton-shimmer h-10 w-40 animate-pulse rounded-xl bg-surface-elevated" />
        <div className="skeleton-shimmer h-10 w-40 animate-pulse rounded-xl bg-surface-elevated" />
      </div>
    </header>
  );
}

function ServiceTimelineFallback() {
  return (
    <Card>
      <div className="skeleton-shimmer h-4 w-44 animate-pulse rounded-md bg-surface-elevated" />

      <div className="mt-4 space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={`timeline-fallback-${index}`} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="skeleton-shimmer h-4 w-3/5 animate-pulse rounded-md bg-surface-elevated" />
                <div className="skeleton-shimmer h-3.5 w-full animate-pulse rounded-md bg-surface-elevated" />
                <div className="skeleton-shimmer h-3.5 w-4/5 animate-pulse rounded-md bg-surface-elevated" />
              </div>

              <div className="w-28 space-y-2">
                <div className="skeleton-shimmer h-7 w-full animate-pulse rounded-lg bg-surface-elevated" />
                <div className="skeleton-shimmer h-3.5 w-full animate-pulse rounded-md bg-surface-elevated" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ServicePriorityFallback() {
  return (
    <Card>
      <div className="skeleton-shimmer h-4 w-40 animate-pulse rounded-md bg-surface-elevated" />

      <div className="mt-4 space-y-2.5">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={`priority-fallback-${index}`} className="rounded-lg border border-border bg-surface p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="skeleton-shimmer h-4 w-2/3 animate-pulse rounded-md bg-surface-elevated" />
                <div className="skeleton-shimmer h-3.5 w-full animate-pulse rounded-md bg-surface-elevated" />
              </div>

              <div className="skeleton-shimmer h-7 w-20 animate-pulse rounded-lg bg-surface-elevated" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

async function ServiceCenterHeader() {
  const headerData = await getServiceCenterHeaderData();

  return (
    <PageHeader
      title="Servisni centar"
      description="Centralno mjesto za intervencije, incidente i prioritizaciju servisa po riziku."
      actions={
        <>
          <FallbackChip isUsingFallbackData={headerData.isUsingFallbackData} />
          <Badge variant={headerData.openServices > 0 ? "warning" : "success"}>
            Otvoren servis: {headerData.openServices}
          </Badge>
          <Badge variant={headerData.openFaults > 0 ? "danger" : "neutral"}>
            Otvoreni kvarovi: {headerData.openFaults}
          </Badge>
        </>
      }
    />
  );
}

async function ServiceTimelineCard() {
  const timelineData = await getServiceCenterTimelineData();

  return (
    <Card>
      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
        Service timeline
      </h3>

      {timelineData.serviceTimeline.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nema servisnih intervencija za prikaz.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {timelineData.serviceTimeline.slice(0, 12).map((service) => (
            <li key={service.id} className="rounded-xl border border-border bg-slate-950/60 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-100">
                    {service.vehicleLabel}
                    <span className="text-slate-400"> ({service.plate})</span>
                  </p>
                  <p className="mt-1 text-sm text-slate-200">{service.description}</p>
                  <p className="mt-1 text-xs text-muted">
                    Start: {formatDate(service.startedAtIso)}
                    {service.endedAtIso ? ` • Kraj: ${formatDate(service.endedAtIso)}` : " • U tijeku"}
                  </p>
                </div>

                <div className="text-right">
                  <Badge variant={service.isOpen ? "warning" : "success"}>
                    {service.isOpen ? "U tijeku" : "Završeno"}
                  </Badge>
                  <p className="mt-2 data-font text-sm text-slate-200">
                    {service.kmAtMoment.toLocaleString("hr-HR")} km
                  </p>
                  <p className="mt-1 data-font text-sm text-amber-200">
                    {service.cost.toLocaleString("hr-HR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    <span className="ml-1 text-xs text-amber-300">EUR</span>
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function ServicePriorityCard() {
  const priorityData = await getServiceCenterPriorityData();

  return (
    <Card>
      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
        Prioritetne stavke
      </h3>

      {priorityData.openFaults.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nema otvorenih servisnih stavki.</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {priorityData.openFaults.slice(0, 8).map((fault) => (
            <li
              key={fault.id}
              className="rounded-lg border border-border bg-slate-950/60 px-3 py-2 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-100">
                    {fault.vehicleLabel}
                    <span className="text-slate-400"> ({fault.plate})</span>
                  </p>
                  <p className="mt-1 text-xs text-muted">{fault.description}</p>
                </div>
                <Badge
                  variant={
                    fault.priority === "kriticno"
                      ? "danger"
                      : fault.priority === "visoko"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {getPriorityLabel(fault.priority)}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function ServisniCentarPage() {
  return (
    <div className="space-y-5">
      <Suspense fallback={<ServiceCenterHeaderFallback />}>
        <ServiceCenterHeader />
      </Suspense>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Suspense fallback={<ServiceTimelineFallback />}>
          <ServiceTimelineCard />
        </Suspense>

        <Suspense fallback={<ServicePriorityFallback />}>
          <ServicePriorityCard />
        </Suspense>
      </div>
    </div>
  );
}
