"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AttachmentViewerButton } from "@/components/attachments/attachment-viewer-button";
import { FallbackChip } from "@/components/dashboard/fallback-chip";
import {
  ServiceCenterCostCharts,
  type PeriodFilter,
} from "@/components/service-center/service-center-cost-charts";
import { ServiceHistoryFilters } from "@/components/service-center/service-history-filters";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ServerPagination } from "@/components/ui/server-pagination";
import type {
  ServiceCenterHeaderData,
  ServiceCenterTimelineData,
} from "@/lib/fleet/operations-service";
import { useLiveSourceRefresh } from "@/lib/hooks/use-live-source-refresh";
import { formatDate } from "@/lib/utils/date-format";
import { replaceCurrentUrlQueryParams } from "@/lib/utils/url-query";

interface PovijestServisaLivePageContentProps {
  initialTimelineData: ServiceCenterTimelineData;
  initialHeaderData: ServiceCenterHeaderData;
  selectedVehicleId: number | null;
  currentPage: number;
  selectedPeriod: PeriodFilter;
}

const ITEMS_PER_PAGE = 10;
const LIVE_SERVICE_CENTER_SOURCE_TABLES = [
  "servisne_intervencije",
  "zaduzenja",
  "vozila",
  "prijave_kvarova",
  "kategorije_kvarova",
];

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

export function PovijestServisaLivePageContent({
  initialTimelineData,
  initialHeaderData,
  selectedVehicleId,
  currentPage,
  selectedPeriod,
}: PovijestServisaLivePageContentProps) {
  const [timelineData, setTimelineData] = useState(initialTimelineData);
  const [headerData, setHeaderData] = useState(initialHeaderData);
  const [timelinePage, setTimelinePage] = useState(currentPage);

  const refreshServiceCenterData = useCallback(async () => {
    const query = new URLSearchParams();

    if (selectedVehicleId) {
      query.set("vozilo", String(selectedVehicleId));
    }

    if (selectedPeriod) {
      query.set("period", selectedPeriod);
    }

    const queryString = query.toString();
    const targetUrl = queryString
      ? `/api/live/service-center?${queryString}`
      : "/api/live/service-center";

    const response = await fetch(targetUrl, {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      timelineData?: ServiceCenterTimelineData;
      headerData?: ServiceCenterHeaderData;
    };

    if (payload.timelineData) {
      setTimelineData(payload.timelineData);
    }

    if (payload.headerData) {
      setHeaderData(payload.headerData);
    }
  }, [selectedPeriod, selectedVehicleId]);

  useLiveSourceRefresh({
    sourceTables: LIVE_SERVICE_CENTER_SOURCE_TABLES,
    onRefresh: refreshServiceCenterData,
  });

  const vehicleOptions = useMemo(
    () =>
      Array.from(
        new Map(
          timelineData.serviceTimeline
            .filter((service) => service.vehicleId)
            .map((service) => [service.vehicleId!, { id: service.vehicleId!, label: service.vehicleLabel, plate: service.plate }]),
        ).values(),
      ).sort((left, right) => left.label.localeCompare(right.label, "hr")),
    [timelineData.serviceTimeline],
  );

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
  const safeCurrentPage = Math.min(Math.max(timelinePage, 1), totalPages);
  const pagedCompletedTimeline = completedTimeline.slice(
    (safeCurrentPage - 1) * ITEMS_PER_PAGE,
    safeCurrentPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    replaceCurrentUrlQueryParams({
      vozilo: selectedVehicleId ? String(selectedVehicleId) : null,
      period: selectedPeriod,
      stranica: safeCurrentPage > 1 ? String(safeCurrentPage) : null,
    });
  }, [safeCurrentPage, selectedPeriod, selectedVehicleId]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Povijest servisa"
        description="Povijest servisa, troškovi po kategorijama i trendovi po vremenskom razdoblju."
        actions={
          <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start lg:w-auto lg:justify-end">
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
            <ul className="max-h-[68vh] space-y-2 overflow-y-auto pr-1 md:hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {pagedCompletedTimeline.map((service) => (
                <li key={`mobile-${service.id}`} className="rounded-xl border border-border bg-slate-950/60 px-2.5 py-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-100">
                        {service.vehicleLabel}
                        <span className="text-slate-400"> ({service.plate})</span>
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-200">{service.description}</p>
                      <p className="mt-1 text-xs text-muted">
                        Start: {formatDate(service.startedAtIso)} • Kraj: {formatDate(service.endedAtIso ?? service.startedAtIso)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <AttachmentViewerButton
                        attachmentSource={service.attachmentUrl}
                        title={`${service.vehicleLabel} (${service.plate})`}
                      />
                      <div className="flex flex-wrap gap-1">
                        {service.categoryLabel ? <Badge variant="neutral">{service.categoryLabel}</Badge> : null}
                        <Badge variant="success">Završeno</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                    <p className="data-font text-slate-200">
                      {service.kmAtMoment.toLocaleString("hr-HR")} km
                    </p>
                    <p className="data-font text-amber-200">
                      {service.cost.toLocaleString("hr-HR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      <span className="ml-1 text-xs text-amber-300">EUR</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden max-h-[72vh] overflow-auto md:block">
              <table className="min-w-230 text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-surface text-xs uppercase tracking-[0.2em] text-muted">
                    <th className="sticky top-0 min-w-44 bg-surface px-3 py-2.5">Vozilo</th>
                    <th className="sticky top-0 min-w-72 bg-surface px-3 py-2.5">Opis</th>
                    <th className="sticky top-0 min-w-52 bg-surface px-3 py-2.5">Datumi</th>
                    <th className="sticky top-0 min-w-24 bg-surface px-3 py-2.5 text-right">KM</th>
                    <th className="sticky top-0 min-w-28 bg-surface px-3 py-2.5 text-right">Cijena</th>
                    <th className="sticky top-0 min-w-40 bg-surface px-3 py-2.5">Status</th>
                    <th className="sticky top-0 min-w-20 bg-surface px-3 py-2.5 text-right">Privitci</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedCompletedTimeline.map((service) => (
                    <tr key={`desktop-${service.id}`} className="border-b border-border/60 transition-colors hover:bg-slate-900/45 last:border-0">
                      <td className="px-3 py-3 align-top">
                        <p className="font-semibold text-slate-100">{service.vehicleLabel}</p>
                        <p className="text-xs text-slate-400">{service.plate}</p>
                      </td>
                      <td className="px-3 py-3 align-top text-slate-200">{service.description}</td>
                      <td className="px-3 py-3 align-top text-xs text-muted">
                        <p>Start: {formatDate(service.startedAtIso)}</p>
                        <p>Kraj: {formatDate(service.endedAtIso ?? service.startedAtIso)}</p>
                      </td>
                      <td className="px-3 py-3 align-top text-right data-font text-slate-200">
                        {service.kmAtMoment.toLocaleString("hr-HR")}
                      </td>
                      <td className="px-3 py-3 align-top text-right data-font text-amber-200">
                        {service.cost.toLocaleString("hr-HR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex flex-wrap gap-2">
                          {service.categoryLabel ? <Badge variant="neutral">{service.categoryLabel}</Badge> : null}
                          <Badge variant="success">Završeno</Badge>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top text-right">
                        <AttachmentViewerButton
                          attachmentSource={service.attachmentUrl}
                          title={`${service.vehicleLabel} (${service.plate})`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ServerPagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              onPageChange={setTimelinePage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
