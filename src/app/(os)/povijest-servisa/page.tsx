import { AttachmentViewerButton } from "@/components/attachments/attachment-viewer-button";
import { FallbackChip } from "@/components/dashboard/fallback-chip";
import { ServiceCenterCostCharts } from "@/components/service-center/service-center-cost-charts";
import { ServiceHistoryFilters } from "@/components/service-center/service-history-filters";
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
import type { PeriodFilter } from "@/components/service-center/service-center-cost-charts";

interface PovijestServisaPageProps {
  searchParams?: Promise<{ vozilo?: string; stranica?: string; period?: string }>;
}

const ITEMS_PER_PAGE = 10;
const PERIOD_FILTERS: PeriodFilter[] = ["3", "6", "12", "all"];

function getPeriodStartDate(period: PeriodFilter) {
  if (period === "all") {
    return null;
  }

  const monthCount = Number(period);

  if (!Number.isInteger(monthCount) || monthCount <= 0) {
    return null;
  }

  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - (monthCount - 1), 1);
}

function isServiceWithinPeriod(
  service: { endedAtIso: string | null; startedAtIso: string },
  period: PeriodFilter,
) {
  const periodStart = getPeriodStartDate(period);

  if (!periodStart) {
    return true;
  }

  const referenceDate = new Date(service.endedAtIso ?? service.startedAtIso);

  if (Number.isNaN(referenceDate.getTime())) {
    return false;
  }

  return referenceDate.getTime() >= periodStart.getTime();
}

function parsePeriodFilter(value: string | undefined): PeriodFilter {
  if (!value) {
    return "6";
  }

  return PERIOD_FILTERS.includes(value as PeriodFilter)
    ? (value as PeriodFilter)
    : "6";
}

function buildPovijestServisaHref(params: {
  vozilo?: string;
  stranica?: number;
  period?: PeriodFilter;
}) {
  const query = new URLSearchParams();

  if (params.vozilo) {
    query.set("vozilo", params.vozilo);
  }

  if (params.period) {
    query.set("period", params.period);
  }

  if (params.stranica && params.stranica > 1) {
    query.set("stranica", String(params.stranica));
  }

  const queryString = query.toString();

  return queryString ? `/povijest-servisa?${queryString}` : "/povijest-servisa";
}

export default async function PovijestServisaPage({ searchParams }: PovijestServisaPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedVehicleId = parsePositiveIntegerParam(resolvedSearchParams?.vozilo);
  const currentPage = parsePageParam(resolvedSearchParams?.stranica);
  const selectedPeriod = parsePeriodFilter(resolvedSearchParams?.period);

  const [timelineData, headerData] = await Promise.all([
    getServiceCenterTimelineData(),
    getServiceCenterHeaderData({ vehicleId: selectedVehicleId, period: selectedPeriod }),
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

  const periodFilteredTimeline = filteredTimeline.filter((service) =>
    isServiceWithinPeriod(service, selectedPeriod),
  );

  const completedTimeline = periodFilteredTimeline
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
    buildPovijestServisaHref({
      vozilo: selectedVehicleId ? String(selectedVehicleId) : undefined,
      stranica: page,
      period: selectedPeriod,
    });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Povijest servisa"
        description="Povijest servisa, troškovi po kategorijama i trendovi po vremenskom razdoblju."
        actions={
          <div className="flex w-full flex-wrap items-center justify-start gap-2 lg:w-auto lg:justify-end">
            <ServiceHistoryFilters
              selectedVehicleId={selectedVehicleId}
              selectedPeriod={selectedPeriod}
              vehicleOptions={vehicleOptions}
            />

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

      <ServiceCenterCostCharts
        serviceTimeline={filteredTimeline}
        showTopVehicles={!selectedVehicleId}
        initialPeriod={selectedPeriod}
      />

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

                      <AttachmentViewerButton
                        attachmentSource={service.attachmentUrl}
                        title={`${service.vehicleLabel} (${service.plate})`}
                        className="mt-2"
                      />
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
