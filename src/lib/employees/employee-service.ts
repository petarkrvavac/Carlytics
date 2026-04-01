import {
  getRoleLabelFromName,
} from "@/lib/auth/roles";
import {
  applyInterventionVisibilityFilter,
  isInterventionOpen,
} from "@/lib/fleet/intervention-utils";
import { createOptionalServerSupabaseClient } from "@/lib/supabase/server";
import { createOptionalServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type { Tables } from "@/types/database";

type EmployeeRow = Pick<
  Tables<"zaposlenici">,
  "id" | "ime" | "prezime" | "email" | "korisnicko_ime" | "uloga_id" | "mjesto_id" | "is_aktivan"
>;
type AssignmentActivityRow = Pick<
  Tables<"zaduzenja">,
  "id" | "datum_od" | "datum_do" | "is_aktivno" | "km_pocetna" | "km_zavrsna" | "vozilo_id"
>;
type FaultActivityRow = Pick<
  Tables<"servisne_intervencije">,
  "id" | "datum_pocetka" | "datum_zavrsetka" | "opis" | "hitnost" | "status_prijave" | "vozilo_id"
>;
type FuelActivityRow = Pick<
  Tables<"evidencija_goriva">,
  "id" | "datum" | "km_tocenja" | "litraza" | "cijena_po_litri" | "ukupni_iznos" | "zaduzenje_id"
>;
type VehicleActivityRow = Pick<Tables<"vozila">, "id" | "model_id" | "trenutna_km">;
type ModelActivityRow = Pick<Tables<"modeli">, "id" | "naziv" | "proizvodjac_id">;
type ManufacturerActivityRow = Pick<Tables<"proizvodjaci">, "id" | "naziv">;
type RegistrationActivityRow = Pick<
  Tables<"registracije">,
  "vozilo_id" | "registracijska_oznaka" | "datum_isteka"
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

export interface EmployeeRecentFaultItem {
  id: number;
  reportedAtIso: string;
  vehicleLabel: string;
  plate: string;
  description: string;
  priority: string;
  status: string;
}

export interface EmployeeRecentFuelItem {
  id: number;
  dateIso: string;
  vehicleLabel: string;
  plate: string;
  kmAtFill: number;
  liters: number;
  pricePerLiter: number;
  totalAmount: number;
}

export interface EmployeeRecentAssignmentItem {
  id: number;
  startedAtIso: string;
  endedAtIso: string | null;
  vehicleLabel: string;
  plate: string;
  kmStart: number;
  kmEnd: number;
  distanceKm: number;
  isActive: boolean;
}

export interface EmployeeMonthlyKmPoint {
  monthLabel: string;
  km: number;
}

export interface EmployeeOperationalInsights {
  employee: EmployeeProfileDetails | null;
  recentFaults: EmployeeRecentFaultItem[];
  recentFuelEntries: EmployeeRecentFuelItem[];
  recentAssignments: EmployeeRecentAssignmentItem[];
  monthlyKmSeries: EmployeeMonthlyKmPoint[];
  isUsingFallbackData: boolean;
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
  return getRoleLabelFromName(normalizeLabel(rawRoleName));
}

const HR_MONTH_LABELS = ["Sij", "Velj", "Ožu", "Tra", "Svi", "Lip", "Srp", "Kol", "Ruj", "Lis", "Stu", "Pro"] as const;
const RECENT_ACTIVITY_LIMIT = 3;

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function compareDatesDesc(leftIso: string | null | undefined, rightIso: string | null | undefined) {
  const leftTime = parseDate(leftIso)?.getTime() ?? 0;
  const rightTime = parseDate(rightIso)?.getTime() ?? 0;
  return rightTime - leftTime;
}

function getLatestRegistrations(registrations: RegistrationActivityRow[]) {
  const grouped = new Map<number, RegistrationActivityRow[]>();

  for (const row of registrations) {
    if (!row.vozilo_id) {
      continue;
    }

    const existing = grouped.get(row.vozilo_id) ?? [];
    existing.push(row);
    grouped.set(row.vozilo_id, existing);
  }

  const latestByVehicle = new Map<number, RegistrationActivityRow>();

  for (const [vehicleId, entries] of grouped) {
    entries.sort((left, right) => compareDatesDesc(left.datum_isteka, right.datum_isteka));
    const latest = entries[0];

    if (latest) {
      latestByVehicle.set(vehicleId, latest);
    }
  }

  return latestByVehicle;
}

function normalizeFaultPriority(hitnost: string | null) {
  if (!hitnost) {
    return "Srednje";
  }

  const normalized = hitnost.toLowerCase();

  if (normalized.includes("krit")) {
    return "Kritično";
  }

  if (normalized.includes("vis") || normalized.includes("high") || normalized.includes("hitno")) {
    return "Visoko";
  }

  if (normalized.includes("nisk") || normalized.includes("low")) {
    return "Nisko";
  }

  return "Srednje";
}

function normalizeFaultStatus(status: string | null) {
  if (!status) {
    return "Novo";
  }

  const normalized = status.toLowerCase();

  if (normalized.includes("obr")) {
    return "U obradi";
  }

  if (
    normalized.includes("zat") ||
    normalized.includes("rije") ||
    normalized.includes("rijes") ||
    normalized.includes("closed") ||
    normalized.includes("res")
  ) {
    return "Riješeno";
  }

  return "Novo";
}

function toMonthKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

function buildMonthlyKmSeries(assignments: EmployeeRecentAssignmentItem[]) {
  const now = new Date();
  const monthKeys: string[] = [];

  for (let index = 5; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    monthKeys.push(toMonthKey(date));
  }

  const kmByMonth = new Map<string, number>(monthKeys.map((key) => [key, 0]));

  for (const assignment of assignments) {
    const referenceDate = parseDate(assignment.endedAtIso ?? assignment.startedAtIso);

    if (!referenceDate) {
      continue;
    }

    const monthKey = toMonthKey(referenceDate);

    if (!kmByMonth.has(monthKey)) {
      continue;
    }

    const current = kmByMonth.get(monthKey) ?? 0;
    kmByMonth.set(monthKey, current + assignment.distanceKm);
  }

  return monthKeys.map((monthKey) => {
    const monthPart = Number(monthKey.split("-")[1] ?? "1") - 1;

    return {
      monthLabel: HR_MONTH_LABELS[Math.max(0, Math.min(11, monthPart))],
      km: Math.round(kmByMonth.get(monthKey) ?? 0),
    };
  });
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

export async function getEmployeeOperationalInsights(
  employeeId: number,
): Promise<EmployeeOperationalInsights> {
  const serviceRoleClient = createOptionalServiceRoleSupabaseClient();
  const client = serviceRoleClient ?? createOptionalServerSupabaseClient();

  if (!client) {
    return {
      employee: null,
      recentFaults: [],
      recentFuelEntries: [],
      recentAssignments: [],
      monthlyKmSeries: [],
      isUsingFallbackData: true,
    };
  }

  try {
    const employee = await getEmployeeProfileDetails(employeeId);

    if (!employee) {
      return {
        employee: null,
        recentFaults: [],
        recentFuelEntries: [],
        recentAssignments: [],
        monthlyKmSeries: [],
        isUsingFallbackData: false,
      };
    }

    const [assignmentsResult, faultsResult, vehiclesResult, modelsResult, manufacturersResult, registrationsResult] = await Promise.all([
      client
        .from("zaduzenja")
        .select("id, datum_od, datum_do, is_aktivno, km_pocetna, km_zavrsna, vozilo_id")
        .eq("zaposlenik_id", employeeId),
      applyInterventionVisibilityFilter(
        client
          .from("servisne_intervencije")
          .select("id, datum_pocetka, datum_zavrsetka, opis, hitnost, status_prijave, vozilo_id")
          .eq("zaposlenik_id", employeeId),
      ),
      client.from("vozila").select("id, model_id, trenutna_km"),
      client.from("modeli").select("id, naziv, proizvodjac_id"),
      client.from("proizvodjaci").select("id, naziv"),
      client.from("registracije").select("vozilo_id, registracijska_oznaka, datum_isteka"),
    ] as const);

    const queryError = [
      assignmentsResult.error,
      faultsResult.error,
      vehiclesResult.error,
      modelsResult.error,
      manufacturersResult.error,
      registrationsResult.error,
    ].find((error) => Boolean(error));

    if (queryError) {
      throw queryError;
    }

    const assignments = (assignmentsResult.data ?? []) as AssignmentActivityRow[];
    const faults = (faultsResult.data ?? []) as FaultActivityRow[];
    const vehicles = (vehiclesResult.data ?? []) as VehicleActivityRow[];
    const models = (modelsResult.data ?? []) as ModelActivityRow[];
    const manufacturers = (manufacturersResult.data ?? []) as ManufacturerActivityRow[];
    const registrations = (registrationsResult.data ?? []) as RegistrationActivityRow[];

    const assignmentIds = assignments.map((assignment) => assignment.id);
    let fuelRows: FuelActivityRow[] = [];

    if (assignmentIds.length > 0) {
      const { data: fuelData, error: fuelError } = await client
        .from("evidencija_goriva")
        .select("id, datum, km_tocenja, litraza, cijena_po_litri, ukupni_iznos, zaduzenje_id")
        .in("zaduzenje_id", assignmentIds);

      if (fuelError) {
        throw fuelError;
      }

      fuelRows = (fuelData ?? []) as FuelActivityRow[];
    }

    const modelById = new Map(models.map((model) => [model.id, model]));
    const manufacturerById = new Map(
      manufacturers.map((manufacturer) => [manufacturer.id, manufacturer]),
    );
    const latestRegistrationByVehicle = getLatestRegistrations(registrations);

    const vehicleLookup = new Map<
      number,
      {
        label: string;
        plate: string;
        currentKm: number;
      }
    >();

    for (const vehicle of vehicles) {
      const model = vehicle.model_id ? modelById.get(vehicle.model_id) : null;
      const manufacturer = model?.proizvodjac_id
        ? manufacturerById.get(model.proizvodjac_id)
        : null;

      vehicleLookup.set(vehicle.id, {
        label: `${manufacturer?.naziv ?? "Vozilo"} ${model?.naziv ?? "Bez modela"}`.trim(),
        plate:
          latestRegistrationByVehicle.get(vehicle.id)?.registracijska_oznaka ?? `V-${vehicle.id}`,
        currentKm: vehicle.trenutna_km ?? 0,
      });
    }

    const recentAssignments = assignments
      .map<EmployeeRecentAssignmentItem>((assignment) => {
        const vehicle = assignment.vozilo_id ? vehicleLookup.get(assignment.vozilo_id) : null;
        const kmEnd = assignment.km_zavrsna ?? vehicle?.currentKm ?? assignment.km_pocetna;

        return {
          id: assignment.id,
          startedAtIso: assignment.datum_od,
          endedAtIso: assignment.datum_do,
          vehicleLabel: vehicle?.label ?? "Nepoznato vozilo",
          plate: vehicle?.plate ?? "N/A",
          kmStart: assignment.km_pocetna,
          kmEnd,
          distanceKm: Math.max(0, kmEnd - assignment.km_pocetna),
          isActive: Boolean(assignment.is_aktivno),
        };
      })
      .sort((left, right) => compareDatesDesc(left.startedAtIso, right.startedAtIso));

    const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));

    const recentFuelEntries = fuelRows
      .map<EmployeeRecentFuelItem>((entry) => {
        const assignment = entry.zaduzenje_id ? assignmentById.get(entry.zaduzenje_id) : null;
        const vehicle = assignment?.vozilo_id ? vehicleLookup.get(assignment.vozilo_id) : null;

        return {
          id: entry.id,
          dateIso: entry.datum,
          vehicleLabel: vehicle?.label ?? "Nepoznato vozilo",
          plate: vehicle?.plate ?? "N/A",
          kmAtFill: entry.km_tocenja,
          liters: entry.litraza,
          pricePerLiter: entry.cijena_po_litri,
          totalAmount: Number((entry.ukupni_iznos ?? entry.litraza * entry.cijena_po_litri).toFixed(2)),
        };
      })
      .sort((left, right) => compareDatesDesc(left.dateIso, right.dateIso));

    const sortedFaults = [...faults].sort((left, right) => {
      const leftOpen = isInterventionOpen(left.status_prijave, left.datum_zavrsetka);
      const rightOpen = isInterventionOpen(right.status_prijave, right.datum_zavrsetka);

      if (leftOpen !== rightOpen) {
        return leftOpen ? -1 : 1;
      }

      return compareDatesDesc(left.datum_pocetka, right.datum_pocetka);
    });

    const recentFaults = sortedFaults
      .map<EmployeeRecentFaultItem>((fault) => {
        const vehicle = fault.vozilo_id ? vehicleLookup.get(fault.vozilo_id) : null;

        return {
          id: fault.id,
          reportedAtIso: fault.datum_pocetka,
          vehicleLabel: vehicle?.label ?? "Nepoznato vozilo",
          plate: vehicle?.plate ?? "N/A",
          description: fault.opis?.trim() || "Bez opisa",
          priority: normalizeFaultPriority(fault.hitnost),
          status: normalizeFaultStatus(fault.status_prijave),
        };
      });

    return {
      employee,
      recentFaults: recentFaults.slice(0, RECENT_ACTIVITY_LIMIT),
      recentFuelEntries: recentFuelEntries.slice(0, RECENT_ACTIVITY_LIMIT),
      recentAssignments: recentAssignments.slice(0, RECENT_ACTIVITY_LIMIT),
      monthlyKmSeries: buildMonthlyKmSeries(recentAssignments),
      isUsingFallbackData: false,
    };
  } catch (error) {
    console.error("[carlytics] Employee operational insights fallback:", error);

    if (!serviceRoleClient) {
      console.error(
        "[carlytics] SUPABASE_SERVICE_ROLE_KEY nije postavljen; anon čitanje može biti ograničeno RLS pravilima.",
      );
    }

    const fallbackEmployee = await getEmployeeProfileDetails(employeeId);

    return {
      employee: fallbackEmployee,
      recentFaults: [],
      recentFuelEntries: [],
      recentAssignments: [],
      monthlyKmSeries: [],
      isUsingFallbackData: true,
    };
  }
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
      label: resolveRoleLabel(role.naziv),
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