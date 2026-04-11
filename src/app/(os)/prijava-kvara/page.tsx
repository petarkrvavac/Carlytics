import { FaultsSectionContent } from "@/components/faults/faults-section-content";
import { getFleetVehiclesSnapshot } from "@/lib/fleet/dashboard-service";
import { getOperationsOverviewData } from "@/lib/fleet/operations-service";
import { getFaultCategoryOptions } from "@/lib/fleet/worker-context-service";
import { parsePositiveIntegerParam } from "@/lib/utils/page-params";

interface PrijavaKvaraPageProps {
  searchParams?: Promise<{ vozilo?: string }>;
}

export default async function PrijavaKvaraPage({ searchParams }: PrijavaKvaraPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedVehicleId = parsePositiveIntegerParam(resolvedSearchParams?.vozilo);

  const [operationsData, vehicles, categories] = await Promise.all([
    getOperationsOverviewData(),
    getFleetVehiclesSnapshot(),
    getFaultCategoryOptions(),
  ]);

  return (
    <FaultsSectionContent
      operationsData={operationsData}
      vehicles={vehicles}
      categories={categories}
      selectedVehicleId={selectedVehicleId}
    />
  );
}
