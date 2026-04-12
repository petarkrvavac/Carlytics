import { GorivoLivePageContent } from "@/components/fuel/gorivo-live-page-content";
import { getOperationsOverviewData } from "@/lib/fleet/operations-service";
import { parsePageParam, parsePositiveIntegerParam } from "@/lib/utils/page-params";

interface GorivoPageProps {
  searchParams?: Promise<{ vozilo?: string; stranica?: string }>;
}

export default async function GorivoPage({ searchParams }: GorivoPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedVehicleId = parsePositiveIntegerParam(resolvedSearchParams?.vozilo);
  const currentPage = parsePageParam(resolvedSearchParams?.stranica);
  const operationsData = await getOperationsOverviewData();

  return (
    <GorivoLivePageContent
      initialOperationsData={operationsData}
      selectedVehicleId={selectedVehicleId}
      currentPage={currentPage}
    />
  );
}
