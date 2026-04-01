import {
  FleetSectionContent,
  type FleetStatusFilter,
} from "@/components/fleet/fleet-section-content";
import { getFleetVehiclesSnapshot } from "@/lib/fleet/dashboard-service";
import { getVehicleFormContext } from "@/lib/fleet/vehicle-form-context-service";

interface FlotaPageProps {
  searchParams?: Promise<{ status?: string }>;
}

function resolveInitialFilter(value: string | undefined): FleetStatusFilter {
  if (value === "slobodno" || value === "zauzeto" || value === "servis" || value === "neaktivna") {
    return value;
  }

  return "sve";
}

export default async function FlotaPage({ searchParams }: FlotaPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const [vehicles, vehicleFormContext] = await Promise.all([
    getFleetVehiclesSnapshot(),
    getVehicleFormContext(),
  ]);
  const initialFilter = resolveInitialFilter(resolvedSearchParams?.status);

  return (
    <FleetSectionContent
      vehicles={vehicles}
      formContext={vehicleFormContext}
      initialFilter={initialFilter}
    />
  );
}
