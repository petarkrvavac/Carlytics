import {
  FleetSectionContent,
  type FleetStatusFilter,
} from "@/components/fleet/fleet-section-content";
import { getFleetVehiclesSnapshot } from "@/lib/fleet/dashboard-service";
import { getVehicleFormContext } from "@/lib/fleet/vehicle-form-context-service";

interface FlotaPageProps {
  searchParams?: Promise<{
    status?: string;
    q?: string;
    proizvodjac?: string;
    model?: string;
    rizik?: string;
  }>;
}

function resolveInitialFilter(value: string | undefined): FleetStatusFilter {
  if (
    value === "slobodno" ||
    value === "zauzeto" ||
    value === "servis" ||
    value === "neaktivna"
  ) {
    return value;
  }

  return "sve";
}

function parsePositiveParam(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function resolveRiskFilter(value: string | undefined) {
  if (value === "servis" || value === "registracija" || value === "kvar") {
    return value;
  }

  return "sve";
}

export default async function FlotaPage({ searchParams }: FlotaPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialFilter = resolveInitialFilter(resolvedSearchParams?.status);
  const [vehicles, vehicleFormContext] = await Promise.all([
    getFleetVehiclesSnapshot(),
    getVehicleFormContext(),
  ]);

  return (
    <FleetSectionContent
      vehicles={vehicles}
      formContext={vehicleFormContext}
      initialFilter={initialFilter}
      initialSearchQuery={resolvedSearchParams?.q ?? ""}
      initialManufacturerId={parsePositiveParam(resolvedSearchParams?.proizvodjac)}
      initialModelId={parsePositiveParam(resolvedSearchParams?.model)}
      initialRiskFilter={resolveRiskFilter(resolvedSearchParams?.rizik)}
    />
  );
}
