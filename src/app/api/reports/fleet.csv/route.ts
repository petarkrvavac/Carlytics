import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/session";
import { getFleetVehiclesSnapshot } from "@/lib/fleet/dashboard-service";
import type { FleetRiskFilter, FleetStatusFilter } from "@/components/fleet/fleet-section-content";
import { buildCsv } from "@/lib/reports/csv";

export const dynamic = "force-dynamic";

function parsePositive(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function resolveStatus(value: string | null): FleetStatusFilter {
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

function resolveRisk(value: string | null): FleetRiskFilter {
  if (value === "servis" || value === "registracija" || value === "kvar") {
    return value;
  }

  return "sve";
}

export async function GET(request: Request) {
  await requireSessionUser({
    allowedRoles: ["admin", "voditelj_flote"],
    redirectTo: "/prijava",
    forbiddenRedirectTo: "/m",
  });

  const url = new URL(request.url);
  const status = resolveStatus(url.searchParams.get("status"));
  const risk = resolveRisk(url.searchParams.get("rizik"));
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const manufacturerId = parsePositive(url.searchParams.get("proizvodjac"));
  const modelId = parsePositive(url.searchParams.get("model"));
  const vehicles = await getFleetVehiclesSnapshot();

  const filteredVehicles = vehicles.filter((vehicle) => {
    if (status === "neaktivna") {
      if (vehicle.isActive) return false;
    } else if (!vehicle.isActive) {
      return false;
    }

    if (status === "slobodno" && vehicle.status !== "Slobodno") return false;
    if (status === "zauzeto" && vehicle.status !== "Zauzeto") return false;
    if (status === "servis" && vehicle.status !== "Na servisu" && vehicle.openFaultCount === 0) return false;
    if (manufacturerId && vehicle.manufacturerId !== manufacturerId) return false;
    if (modelId && vehicle.modelId !== modelId) return false;
    if (risk === "servis" && !vehicle.isServiceDue && vehicle.serviceDueKm > 2000) return false;
    if (risk === "registracija" && (vehicle.registrationExpiryDays === null || vehicle.registrationExpiryDays > 30)) return false;
    if (risk === "kvar" && vehicle.openFaultCount === 0) return false;

    if (query) {
      const searchable = [vehicle.make, vehicle.model, vehicle.plate, vehicle.vin ?? ""].join(" ").toLowerCase();
      if (!searchable.includes(query)) return false;
    }

    return true;
  });

  const csv = buildCsv(
    [
      "Vozilo ID",
      "Proizvodjac",
      "Model",
      "Registracija",
      "VIN",
      "Status",
      "Aktivno",
      "Razlog deaktivacije",
      "Deaktivirano u",
      "Deaktivirao",
      "Kilometraza",
      "Registracija istice",
      "Servis",
      "Otvoreni kvarovi",
    ],
    filteredVehicles.map((vehicle) => [
      vehicle.id,
      vehicle.make,
      vehicle.model,
      vehicle.plate,
      vehicle.vin,
      vehicle.status,
      vehicle.isActive ? "Da" : "Ne",
      vehicle.deactivationReason ?? "",
      vehicle.deactivatedAtIso ?? "",
      vehicle.deactivatedByName ?? "",
      vehicle.km,
      vehicle.registrationExpiryDateIso,
      vehicle.serviceDueLabel,
      vehicle.openFaultCount,
    ]),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="carlytics-flota.csv"',
      "Cache-Control": "no-store",
    },
  });
}
