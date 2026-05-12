import { PovijestServisaLivePageContent } from "@/components/service-center/povijest-servisa-live-page-content";
import type { PeriodFilter } from "@/components/service-center/service-center-cost-charts";
import {
  getServiceCenterHeaderData,
  getServiceCenterTimelineData,
} from "@/lib/fleet/operations-service";
import { parsePageParam, parsePositiveIntegerParam } from "@/lib/utils/page-params";

interface PovijestServisaPageProps {
  searchParams?: Promise<{
    vozilo?: string;
    stranica?: string;
    period?: string;
    kategorija?: string;
    od?: string;
    do?: string;
  }>;
}

const PERIOD_FILTERS: PeriodFilter[] = ["3", "6", "12", "all"];

function parsePeriodFilter(value: string | undefined): PeriodFilter {
  if (!value) {
    return "6";
  }

  return PERIOD_FILTERS.includes(value as PeriodFilter)
    ? (value as PeriodFilter)
    : "6";
}

export default async function PovijestServisaPage({ searchParams }: PovijestServisaPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedVehicleId = parsePositiveIntegerParam(resolvedSearchParams?.vozilo);
  const currentPage = parsePageParam(resolvedSearchParams?.stranica);
  const selectedPeriod = parsePeriodFilter(resolvedSearchParams?.period);
  const selectedCategoryId = parsePositiveIntegerParam(resolvedSearchParams?.kategorija);
  const dateFrom = resolvedSearchParams?.od ?? "";
  const dateTo = resolvedSearchParams?.do ?? "";

  const [timelineData, headerData] = await Promise.all([
    getServiceCenterTimelineData(),
    getServiceCenterHeaderData({
      vehicleId: selectedVehicleId,
      period: selectedPeriod,
      categoryId: selectedCategoryId,
      dateFrom,
      dateTo,
    }),
  ]);

  return (
    <PovijestServisaLivePageContent
      key={`${selectedVehicleId ?? "all"}-${selectedPeriod}-${selectedCategoryId ?? "all"}-${dateFrom}-${dateTo}-${currentPage}`}
      initialTimelineData={timelineData}
      initialHeaderData={headerData}
      selectedVehicleId={selectedVehicleId}
      currentPage={currentPage}
      selectedPeriod={selectedPeriod}
      selectedCategoryId={selectedCategoryId}
      dateFrom={dateFrom}
      dateTo={dateTo}
    />
  );
}
