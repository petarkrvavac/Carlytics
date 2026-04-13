import { DashboardLivePageContent } from "@/components/dashboard/dashboard-live-page-content";
import { getOperationsOverviewData } from "@/lib/fleet/operations-service";
import { getDashboardData } from "@/lib/fleet/dashboard-service";
import { parsePageParam } from "@/lib/utils/page-params";

interface DashboardPageProps {
  searchParams?: Promise<{ upozorenja?: string; nadzor?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const [dashboardData, operationsData] = await Promise.all([
    getDashboardData(),
    getOperationsOverviewData(),
  ]);

  const currentAlertsPage = parsePageParam(resolvedSearchParams?.upozorenja);
  const currentVehiclesPage = parsePageParam(resolvedSearchParams?.nadzor);

  return (
    <DashboardLivePageContent
      key={`${currentAlertsPage}-${currentVehiclesPage}`}
      initialDashboardData={dashboardData}
      initialOperationsData={operationsData}
      initialAlertsPage={currentAlertsPage}
      initialVehiclesPage={currentVehiclesPage}
    />
  );
}
