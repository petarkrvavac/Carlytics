import { FaultsSectionContent } from "@/components/faults/faults-section-content";
import { getFleetVehiclesSnapshot } from "@/lib/fleet/dashboard-service";
import { getOperationsOverviewData } from "@/lib/fleet/operations-service";
import { getFaultCategoryOptions } from "@/lib/fleet/worker-context-service";
export default async function PrijavaKvaraPage() {
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
    />
  );
}
