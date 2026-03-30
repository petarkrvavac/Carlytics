import { createOptionalServerSupabaseClient } from "@/lib/supabase/server";
import { createOptionalServiceRoleSupabaseClient } from "@/lib/supabase/service-role";

export interface VehicleModelOption {
  id: number;
  label: string;
  manufacturerId: number | null;
  manufacturerLabel: string;
  modelLabel: string;
  fuelCapacity: number | null;
}

export interface VehicleStatusOption {
  id: number;
  label: string;
}

export interface VehicleManufacturerOption {
  id: number;
  label: string;
}

export interface VehicleFormContext {
  modelOptions: VehicleModelOption[];
  statusOptions: VehicleStatusOption[];
  manufacturerOptions: VehicleManufacturerOption[];
  isUsingFallbackData: boolean;
}

export async function getVehicleFormContext(): Promise<VehicleFormContext> {
  const serviceRoleClient = createOptionalServiceRoleSupabaseClient();
  const client = serviceRoleClient ?? createOptionalServerSupabaseClient();

  if (!client) {
    return {
      modelOptions: [],
      statusOptions: [],
      manufacturerOptions: [],
      isUsingFallbackData: true,
    };
  }

  const [modelsResult, manufacturersResult, statusesResult] = await Promise.all([
    client.from("modeli").select("id, naziv, kapacitet_rezervoara, proizvodjac_id"),
    client.from("proizvodjaci").select("id, naziv"),
    client.from("statusi_vozila").select("id, naziv"),
  ] as const);

  const queryError = [
    modelsResult.error,
    manufacturersResult.error,
    statusesResult.error,
  ].find((error) => Boolean(error));

  if (queryError) {
    console.error("[carlytics] Context za dodavanje vozila fallback:", queryError.message);
    if (!serviceRoleClient) {
      console.error(
        "[carlytics] SUPABASE_SERVICE_ROLE_KEY nije postavljen; anon čitanje može biti ograničeno RLS pravilima.",
      );
    }

    return {
      modelOptions: [],
      statusOptions: [],
      manufacturerOptions: [],
      isUsingFallbackData: true,
    };
  }

  const manufacturerOptions = (manufacturersResult.data ?? [])
    .map<VehicleManufacturerOption>((manufacturer) => ({
      id: manufacturer.id,
      label: manufacturer.naziv,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "hr"));

  const manufacturersById = new Map(
    manufacturerOptions.map((manufacturer) => [manufacturer.id, manufacturer.label]),
  );

  const modelOptions = (modelsResult.data ?? [])
    .map<VehicleModelOption>((model) => ({
      manufacturerId: model.proizvodjac_id,
      manufacturerLabel: manufacturersById.get(model.proizvodjac_id ?? -1) ?? "Model",
      modelLabel: model.naziv,
      id: model.id,
      label: `${manufacturersById.get(model.proizvodjac_id ?? -1) ?? "Model"} ${model.naziv}`,
      fuelCapacity: model.kapacitet_rezervoara,
    }))
    .sort((left, right) => {
      const manufacturerCompare = left.manufacturerLabel.localeCompare(
        right.manufacturerLabel,
        "hr",
      );

      if (manufacturerCompare !== 0) {
        return manufacturerCompare;
      }

      return left.modelLabel.localeCompare(right.modelLabel, "hr");
    });

  const statusOptions = (statusesResult.data ?? [])
    .map<VehicleStatusOption>((status) => ({
      id: status.id,
      label: status.naziv,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "hr"));

  return {
    modelOptions,
    statusOptions,
    manufacturerOptions,
    isUsingFallbackData: false,
  };
}
