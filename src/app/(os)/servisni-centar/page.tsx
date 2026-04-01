import Link from "next/link";

import { FallbackChip } from "@/components/dashboard/fallback-chip";
import { ServiceCenterCostCharts } from "@/components/service-center/service-center-cost-charts";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ServerPagination } from "@/components/ui/server-pagination";
import {
  getServiceCenterHeaderData,
  getServiceCenterTimelineData,
} from "@/lib/fleet/operations-service";
import { formatDate } from "@/lib/utils/date-format";
import { parsePageParam, parsePositiveIntegerParam } from "@/lib/utils/page-params";

interface ServisniCentarPageProps {
  searchParams?: Promise<{ vozilo?: string; stranica?: string }>;
}

const ITEMS_PER_PAGE = 10;

function buildServisniCentarHref(params: { vozilo?: string; stranica?: number }) {
  const query = new URLSearchParams();

  if (params.vozilo) {
    query.set("vozilo", params.vozilo);
  }

  if (params.stranica && params.stranica > 1) {
    query.set("stranica", String(params.stranica));
  }

  const queryString = query.toString();

  return queryString ? `/servisni-centar?${queryString}` : "/servisni-centar";
}

export default async function ServisniCentarPage({ searchParams }: ServisniCentarPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedVehicleId = parsePositiveIntegerParam(resolvedSearchParams?.vozilo);
  const currentPage = parsePageParam(resolvedSearchParams?.stranica);

  const [timelineData, headerData] = await Promise.all([
    getServiceCenterTimelineData(),
    getServiceCenterHeaderData({ vehicleId: selectedVehicleId }),
  ]);

  const vehicleOptions = Array.from(
    new Map(
      timelineData.serviceTimeline
        .filter((service) => service.vehicleId)
        .map((service) => [service.vehicleId!, { id: service.vehicleId!, label: service.vehicleLabel, plate: service.plate }]),
    ).values(),
  ).sort((left, right) => left.label.localeCompare(right.label, "hr"));

  const filteredTimeline = selectedVehicleId
    ? timelineData.serviceTimeline.filter((service) => service.vehicleId === selectedVehicleId)
    : timelineData.serviceTimeline;

  const completedTimeline = filteredTimeline
    .filter((service) => !service.isOpen)
    .sort((left, right) => {
      const leftEndedAt = left.endedAtIso ? new Date(left.endedAtIso).getTime() : 0;
      const rightEndedAt = right.endedAtIso ? new Date(right.endedAtIso).getTime() : 0;
      return rightEndedAt - leftEndedAt;
    });

  const totalPages = Math.max(1, Math.ceil(completedTimeline.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedCompletedTimeline = completedTimeline.slice(
    (safeCurrentPage - 1) * ITEMS_PER_PAGE,
    safeCurrentPage * ITEMS_PER_PAGE,
  );

  const pageHref = (page: number) =>
    buildServisniCentarHref({
      vozilo: resolvedSearchParams?.vozilo,
      stranica: page,
    });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Servisni centar"
        description="Povijest servisa, troškovi po kategorijama i trendovi po vremenskom razdoblju."
        actions={
          <div className="flex w-full flex-wrap items-center justify-start gap-2 lg:w-auto lg:justify-end">
            <form method="get" className="mr-1 flex items-center gap-2 rounded-xl border border-border bg-surface px-2 py-1.5">
              <input type="hidden" name="stranica" value="1" />
              <select
                name="vozilo"
                defaultValue={selectedVehicleId ? String(selectedVehicleId) : ""}
                className="carlytics-select h-8 rounded-lg px-2 text-xs"
              >
                <option value="">Sva vozila</option>
                {vehicleOptions.map((vehicleOption) => (
                  <option key={vehicleOption.id} value={vehicleOption.id}>
                    {vehicleOption.label} ({vehicleOption.plate})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="inline-flex h-8 items-center rounded-lg border border-cyan-300 bg-cyan-400 px-3 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Filtriraj
              </button>
              <Link
                href="/servisni-centar"
                className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200"
              >
                Očisti
              </Link>
            </form>

            <FallbackChip
              isUsingFallbackData={headerData.isUsingFallbackData || timelineData.isUsingFallbackData}
            />

            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant={headerData.completedServices > 0 ? "success" : "neutral"}
                className="h-7 px-2 py-0 text-[10px] font-semibold"
              >
                Uspješno servisirano: {headerData.completedServices}
              </Badge>
              <Badge
                variant={headerData.openServices > 0 ? "warning" : "neutral"}
                className="h-7 px-2 py-0 text-[10px] font-semibold"
              >
                U tijeku: {headerData.openServices}
              </Badge>
              <Badge
                variant={headerData.openFaults > 0 ? "danger" : "neutral"}
                className="h-7 px-2 py-0 text-[10px] font-semibold"
              >
                Otvoreni kvarovi: {headerData.openFaults}
              </Badge>
            </div>
          </div>
        }
      />

      <ServiceCenterCostCharts serviceTimeline={filteredTimeline} />

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
            Servisna povijest
          </h3>
          <Badge variant="info">Ukupno: {completedTimeline.length}</Badge>
        </div>

        {completedTimeline.length === 0 ? (
          <p className="text-sm text-muted">Nema završenih servisa za odabrani filter.</p>
        ) : (
          <>
            <ul className="max-h-[66vh] space-y-3 overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {pagedCompletedTimeline.map((service) => (
                <li key={service.id} className="rounded-xl border border-border bg-slate-950/60 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        {service.vehicleLabel}
                        <span className="text-slate-400"> ({service.plate})</span>
                      </p>
                      <p className="mt-1 text-sm text-slate-200">{service.description}</p>
                      <p className="mt-1 text-xs text-muted">
                        Start: {formatDate(service.startedAtIso)} • Kraj: {formatDate(service.endedAtIso ?? service.startedAtIso)}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="flex justify-end gap-2">
                        {service.categoryLabel ? <Badge variant="neutral">{service.categoryLabel}</Badge> : null}
                        <Badge variant="success">Završeno</Badge>
                      </div>
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

            <ServerPagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              hrefForPage={pageHref}
            />
          </>
        )}
      </Card>
    </div>
  );
}
