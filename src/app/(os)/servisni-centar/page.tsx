import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FallbackChip } from "@/components/dashboard/fallback-chip";
import { PageHeader } from "@/components/ui/page-header";
import { getOperationsOverviewData } from "@/lib/fleet/operations-service";

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

export default async function ServisniCentarPage() {
  const operationsData = await getOperationsOverviewData();
  const openFaults = operationsData.faultQueue.filter((fault) => fault.isOpen);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Servisni centar"
        description="Centralno mjesto za intervencije, incidente i prioritizaciju servisa po riziku."
        actions={
          <>
            <FallbackChip isUsingFallbackData={operationsData.isUsingFallbackData} />
            <Badge variant={operationsData.metrics.openServices > 0 ? "warning" : "success"}>
              Otvoren servis: {operationsData.metrics.openServices}
            </Badge>
            <Badge variant={openFaults.length > 0 ? "danger" : "neutral"}>
              Otvoreni kvarovi: {openFaults.length}
            </Badge>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
            Service timeline
          </h3>

          {operationsData.serviceTimeline.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nema servisnih intervencija za prikaz.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {operationsData.serviceTimeline.slice(0, 12).map((service) => (
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

        <Card>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
            Prioritetne stavke
          </h3>

          {openFaults.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nema otvorenih servisnih stavki.</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {openFaults.slice(0, 8).map((fault) => (
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
      </div>
    </div>
  );
}
