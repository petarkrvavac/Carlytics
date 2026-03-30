import {
  getRoleLabel,
  mapRoleNameToAppRole,
} from "@/lib/auth/roles";
import { createOptionalServerSupabaseClient } from "@/lib/supabase/server";
import { createOptionalServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type { Tables } from "@/types/database";

type EmployeeRow = Pick<
  Tables<"zaposlenici">,
  "id" | "ime" | "prezime" | "email" | "korisnicko_ime" | "uloga_id" | "mjesto_id" | "is_aktivan"
>;
type CityRow = Pick<Tables<"mjesta">, "id" | "naziv" | "zupanija_id">;
type CountyRow = Pick<Tables<"zupanije">, "id" | "naziv" | "drzava_id">;
type CountryRow = Pick<Tables<"drzave">, "id" | "naziv">;

interface LocationLookupItem {
  city: string | null;
  county: string | null;
  country: string | null;
}

export interface EmployeeOverviewItem {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  email: string | null;
  role: string;
  city: string | null;
  county: string | null;
  country: string | null;
  isActive: boolean;
}

export interface EmployeesOverviewData {
  employees: EmployeeOverviewItem[];
  metrics: {
    total: number;
    active: number;
    deactivated: number;
  };
  isUsingFallbackData: boolean;
}

export interface EmployeeRoleOption {
  id: number;
  label: string;
}

export interface EmployeeCountryOption {
  id: number;
  label: string;
}

export interface EmployeeCountyOption {
  id: number;
  countryId: number | null;
  label: string;
}

export interface EmployeeCityOption {
  id: number;
  countyId: number | null;
  label: string;
}

export interface EmployeeFormContext {
  roleOptions: EmployeeRoleOption[];
  countryOptions: EmployeeCountryOption[];
  countyOptions: EmployeeCountyOption[];
  cityOptions: EmployeeCityOption[];
  isUsingFallbackData: boolean;
}

export interface EmployeeProfileDetails {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  role: string;
  email: string | null;
  city: string | null;
  county: string | null;
  country: string | null;
}

function normalizeLabel(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.trim();
}

function mapLocationByCity(params: {
  cities: CityRow[];
  counties: CountyRow[];
  countries: CountryRow[];
}) {
  const countryById = new Map(
    params.countries.map((country) => [country.id, normalizeLabel(country.naziv)]),
  );

  const countyById = new Map(
    params.counties.map((county) => [
      county.id,
      {
        county: normalizeLabel(county.naziv),
        countryId: county.drzava_id,
      },
    ]),
  );

  const locationByCityId = new Map<number, LocationLookupItem>();

  for (const city of params.cities) {
    const countyData = city.zupanija_id ? countyById.get(city.zupanija_id) : null;
    const country = countyData?.countryId
      ? (countryById.get(countyData.countryId) ?? null)
      : null;

    locationByCityId.set(city.id, {
      city: normalizeLabel(city.naziv) || null,
      county: countyData?.county || null,
      country,
    });
  }

  return locationByCityId;
}

function compareByLabel(left: string, right: string) {
  return left.localeCompare(right, "hr-HR");
}

function resolveRoleLabel(rawRoleName: string | null | undefined) {
  const normalizedRoleName = normalizeLabel(rawRoleName);
  const fallbackRoleLabel = getRoleLabel(mapRoleNameToAppRole(normalizedRoleName));

  return normalizedRoleName || fallbackRoleLabel;
}

export async function getEmployeesOverviewData(): Promise<EmployeesOverviewData> {
  const serviceRoleClient = createOptionalServiceRoleSupabaseClient();
  const client = serviceRoleClient ?? createOptionalServerSupabaseClient();

  if (!client) {
    return {
      employees: [],
      metrics: {
        total: 0,
        active: 0,
        deactivated: 0,
      },
      isUsingFallbackData: true,
    };
  }

  try {
    const [employeesResult, rolesResult, citiesResult, countiesResult, countriesResult] = await Promise.all([
      client
        .from("zaposlenici")
        .select("id, ime, prezime, email, korisnicko_ime, uloga_id, mjesto_id, is_aktivan"),
      client.from("uloge").select("id, naziv"),
      client.from("mjesta").select("id, naziv, zupanija_id"),
      client.from("zupanije").select("id, naziv, drzava_id"),
      client.from("drzave").select("id, naziv"),
    ] as const);

    const queryError = [
      employeesResult.error,
      rolesResult.error,
      citiesResult.error,
      countiesResult.error,
      countriesResult.error,
    ].find((error) => Boolean(error));

    if (queryError) {
      throw queryError;
    }

    const roleById = new Map((rolesResult.data ?? []).map((role) => [role.id, role]));
    const locationByCityId = mapLocationByCity({
      cities: (citiesResult.data ?? []) as CityRow[],
      counties: (countiesResult.data ?? []) as CountyRow[],
      countries: (countriesResult.data ?? []) as CountryRow[],
    });

    const employees = ((employeesResult.data ?? []) as EmployeeRow[])
      .map<EmployeeOverviewItem>((employee) => {
        const roleData = employee.uloga_id ? roleById.get(employee.uloga_id) : null;
        const locationData = employee.mjesto_id
          ? locationByCityId.get(employee.mjesto_id)
          : null;

        return {
          id: employee.id,
          firstName: normalizeLabel(employee.ime),
          lastName: normalizeLabel(employee.prezime),
          username: normalizeLabel(employee.korisnicko_ime),
          email: employee.email,
          role: resolveRoleLabel(roleData?.naziv),
          city: locationData?.city ?? null,
          county: locationData?.county ?? null,
          country: locationData?.country ?? null,
          isActive: employee.is_aktivan !== false,
        };
      })
      .sort((left, right) => {
        const byFirstName = compareByLabel(left.firstName, right.firstName);

        if (byFirstName !== 0) {
          return byFirstName;
        }

        return compareByLabel(left.lastName, right.lastName);
      });

    const activeCount = employees.filter((employee) => employee.isActive).length;

    return {
      employees,
      metrics: {
        total: employees.length,
        active: activeCount,
        deactivated: employees.length - activeCount,
      },
      isUsingFallbackData: false,
    };
  } catch (error) {
    console.error("[carlytics] Zaposlenici fallback zbog greške:", error);

    if (!serviceRoleClient) {
      console.error(
        "[carlytics] SUPABASE_SERVICE_ROLE_KEY nije postavljen; anon čitanje može biti ograničeno RLS pravilima.",
      );
    }

    return {
      employees: [],
      metrics: {
        total: 0,
        active: 0,
        deactivated: 0,
      },
      isUsingFallbackData: true,
    };
  }
}

export async function getEmployeeProfileDetails(
  employeeId: number,
): Promise<EmployeeProfileDetails | null> {
  const serviceRoleClient = createOptionalServiceRoleSupabaseClient();
  const client = serviceRoleClient ?? createOptionalServerSupabaseClient();

  if (!client) {
    return null;
  }

  const { data: employee, error: employeeError } = await client
    .from("zaposlenici")
    .select("id, ime, prezime, email, korisnicko_ime, uloga_id, mjesto_id")
    .eq("id", employeeId)
    .maybeSingle();

  if (employeeError) {
    console.error("[carlytics] Neuspjelo čitanje profila zaposlenika:", employeeError.message);
    return null;
  }

  if (!employee) {
    return null;
  }

  let roleName: string | null = null;

  if (employee.uloga_id) {
    const { data: roleData, error: roleError } = await client
      .from("uloge")
      .select("naziv")
      .eq("id", employee.uloga_id)
      .maybeSingle();

    if (roleError) {
      console.error("[carlytics] Neuspjelo čitanje uloge za profil:", roleError.message);
    } else {
      roleName = roleData?.naziv ?? null;
    }
  }

  let cityName: string | null = null;
  let countyName: string | null = null;
  let countryName: string | null = null;

  if (employee.mjesto_id) {
    const { data: cityData, error: cityError } = await client
      .from("mjesta")
      .select("naziv, zupanija_id")
      .eq("id", employee.mjesto_id)
      .maybeSingle();

    if (cityError) {
      console.error("[carlytics] Neuspjelo čitanje mjesta za profil:", cityError.message);
    } else {
      cityName = normalizeLabel(cityData?.naziv) || null;

      if (cityData?.zupanija_id) {
        const { data: countyData, error: countyError } = await client
          .from("zupanije")
          .select("naziv, drzava_id")
          .eq("id", cityData.zupanija_id)
          .maybeSingle();

        if (countyError) {
          console.error("[carlytics] Neuspjelo čitanje županije za profil:", countyError.message);
        } else {
          countyName = normalizeLabel(countyData?.naziv) || null;

          if (countyData?.drzava_id) {
            const { data: countryData, error: countryError } = await client
              .from("drzave")
              .select("naziv")
              .eq("id", countyData.drzava_id)
              .maybeSingle();

            if (countryError) {
              console.error(
                "[carlytics] Neuspjelo čitanje države za profil:",
                countryError.message,
              );
            } else {
              countryName = normalizeLabel(countryData?.naziv) || null;
            }
          }
        }
      }
    }
  }

  return {
    id: employee.id,
    firstName: normalizeLabel(employee.ime),
    lastName: normalizeLabel(employee.prezime),
    username: normalizeLabel(employee.korisnicko_ime),
    role: resolveRoleLabel(roleName),
    email: employee.email,
    city: cityName,
    county: countyName,
    country: countryName,
  };
}

export async function getEmployeeFormContext(): Promise<EmployeeFormContext> {
  const serviceRoleClient = createOptionalServiceRoleSupabaseClient();
  const client = serviceRoleClient ?? createOptionalServerSupabaseClient();

  if (!client) {
    return {
      roleOptions: [],
      countryOptions: [],
      countyOptions: [],
      cityOptions: [],
      isUsingFallbackData: true,
    };
  }

  const [rolesResult, countriesResult, countiesResult, citiesResult] = await Promise.all([
    client.from("uloge").select("id, naziv"),
    client.from("drzave").select("id, naziv"),
    client.from("zupanije").select("id, naziv, drzava_id"),
    client.from("mjesta").select("id, naziv, zupanija_id"),
  ] as const);

  const queryError = [
    rolesResult.error,
    countriesResult.error,
    countiesResult.error,
    citiesResult.error,
  ].find((error) => Boolean(error));

  if (queryError) {
    console.error("[carlytics] Form context zaposlenika fallback:", queryError.message);

    if (!serviceRoleClient) {
      console.error(
        "[carlytics] SUPABASE_SERVICE_ROLE_KEY nije postavljen; anon čitanje može biti ograničeno RLS pravilima.",
      );
    }

    return {
      roleOptions: [],
      countryOptions: [],
      countyOptions: [],
      cityOptions: [],
      isUsingFallbackData: true,
    };
  }

  const roleOptions = (rolesResult.data ?? [])
    .map<EmployeeRoleOption>((role) => ({
      id: role.id,
      label: normalizeLabel(role.naziv),
    }))
    .sort((left, right) => compareByLabel(left.label, right.label));

  const countryOptions = (countriesResult.data ?? [])
    .map<EmployeeCountryOption>((country) => ({
      id: country.id,
      label: normalizeLabel(country.naziv),
    }))
    .sort((left, right) => compareByLabel(left.label, right.label));

  const countyOptions = (countiesResult.data ?? [])
    .map<EmployeeCountyOption>((county) => ({
      id: county.id,
      countryId: county.drzava_id,
      label: normalizeLabel(county.naziv),
    }))
    .sort((left, right) => compareByLabel(left.label, right.label));

  const cityOptions = (citiesResult.data ?? [])
    .map<EmployeeCityOption>((city) => ({
      id: city.id,
      countyId: city.zupanija_id,
      label: normalizeLabel(city.naziv),
    }))
    .sort((left, right) => compareByLabel(left.label, right.label));

  return {
    roleOptions,
    countryOptions,
    countyOptions,
    cityOptions,
    isUsingFallbackData: false,
  };
}