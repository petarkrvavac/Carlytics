import Link from "next/link";
import { Download } from "lucide-react";

import { PrintReportButton } from "@/components/reports/print-report-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireSessionUser } from "@/lib/auth/session";
import { getFleetVehiclesSnapshot } from "@/lib/fleet/dashboard-service";
import { isVehicleServiceUrgent } from "@/lib/fleet/service-due";
import {
  getOperationsOverviewData,
  getServiceCenterTimelineData,
} from "@/lib/fleet/operations-service";

function formatAmount(value: number) {
  return value.toLocaleString("hr-HR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function toMonthKey(value: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatRegistrationExpiry(days: number | null) {
  if (days === null) {
    return "N/A";
  }

  if (days < 0) {
    return `Istekla prije ${Math.abs(days)} dana`;
  }

  if (days === 0) {
    return "Danas ističe";
  }

  return `Ističe za ${days} dana`;
}

export default async function IzvjescaPage() {
  const [currentUser, vehicles, serviceData, operationsData] = await Promise.all([
    requireSessionUser({
      allowedRoles: ["admin", "voditelj_flote"],
      redirectTo: "/prijava",
      forbiddenRedirectTo: "/m",
    }),
    getFleetVehiclesSnapshot(),
    getServiceCenterTimelineData(),
    getOperationsOverviewData(),
  ]);

  const activeVehicles = vehicles.filter((vehicle) => vehicle.isActive);
  const registrationRisk = activeVehicles.filter(
    (vehicle) => vehicle.registrationExpiryDays !== null && vehicle.registrationExpiryDays <= 30,
  );
  const serviceRisk = activeVehicles.filter((vehicle) => isVehicleServiceUrgent(vehicle));
  const completedServices = serviceData.serviceTimeline.filter((service) => !service.isOpen);
  const costByCategory = new Map<string, number>();
  const costByMonth = new Map<string, number>();
  const costByVehicle = new Map<string, number>();
  const fuelCostByMonth = new Map<string, number>();
  const fuelCostByVehicle = new Map<string, number>();

  for (const service of completedServices) {
    const category = service.categoryLabel ?? "Nekategorizirano";
    costByCategory.set(category, (costByCategory.get(category) ?? 0) + service.cost);
    const monthKey = toMonthKey(service.endedAtIso ?? service.startedAtIso);
    costByMonth.set(monthKey, (costByMonth.get(monthKey) ?? 0) + service.cost);
    const vehicleKey = `${service.vehicleLabel} (${service.plate})`;
    costByVehicle.set(vehicleKey, (costByVehicle.get(vehicleKey) ?? 0) + service.cost);
  }

  for (const entry of operationsData.fuelLedger) {
    const monthKey = toMonthKey(entry.dateIso);
    fuelCostByMonth.set(monthKey, (fuelCostByMonth.get(monthKey) ?? 0) + entry.totalAmount);
    const vehicleKey = `${entry.vehicleLabel} (${entry.plate})`;
    fuelCostByVehicle.set(vehicleKey, (fuelCostByVehicle.get(vehicleKey) ?? 0) + entry.totalAmount);
  }

  const totalServiceCost = completedServices.reduce((sum, service) => sum + service.cost, 0);
  const totalFuelCost = operationsData.fuelLedger.reduce((sum, entry) => sum + entry.totalAmount, 0);
  const csvQuery = "";

  return (
    <div className="space-y-5 print:bg-white print:text-slate-950">
      <div className="hidden items-start justify-between gap-4 border-b border-border/70 pb-5 print:flex">
        <div className="flex items-center gap-3">
          <img src="/carlytics-logo.png" alt="Carlytics" className="h-12 w-12 rounded-xl object-contain" />
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">Carlytics Fleet OS</p>
            <p className="mt-1 text-sm text-foreground">Izvješća</p>
          </div>
        </div>

        <div className="text-right text-sm text-muted">
          <p className="font-medium text-foreground">{currentUser.fullName}</p>
          <p>{currentUser.roleLabel}</p>
        </div>
      </div>

      <PageHeader
        title="Izvješća"
        description="Osnovna izvješća o stanju flote, servisnim rizicima i troškovima."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/api/reports/fleet.csv${csvQuery}`}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200 print:hidden"
            >
              <Download size={15} />
              Flota CSV
            </Link>
            <Link
              href={`/api/reports/service-interventions.csv${csvQuery}`}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200 print:hidden"
            >
              <Download size={15} />
              Servisi CSV
            </Link>
            <Link
              href={`/api/reports/fuel.csv${csvQuery}`}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200 print:hidden"
            >
              <Download size={15} />
              Gorivo CSV
            </Link>
            <PrintReportButton />
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Card>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Aktivna vozila</p>
          <p className="mt-2 data-font text-3xl text-cyan-200 print:text-slate-950">{activeVehicles.length}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Registracija 30 dana</p>
          <p className="mt-2 data-font text-3xl text-amber-200 print:text-slate-950">{registrationRisk.length}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Servisni rizik</p>
          <p className="mt-2 data-font text-3xl text-rose-200 print:text-slate-950">{serviceRisk.length}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Trošak servisa</p>
          <p className="mt-2 data-font text-3xl text-emerald-200 print:text-slate-950">{formatAmount(totalServiceCost)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Trošak goriva</p>
          <p className="mt-2 data-font text-3xl text-sky-200 print:text-slate-950">{formatAmount(totalFuelCost)}</p>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">Vozila za registraciju</h2>
            <Badge variant="warning">{registrationRisk.length}</Badge>
          </div>
          <ul className="space-y-2">
            {registrationRisk.map((vehicle) => (
              <li key={vehicle.id} className="flex justify-between gap-3 border-b border-border/60 pb-2 text-sm last:border-0">
                <span>{vehicle.make} {vehicle.model} ({vehicle.plate})</span>
                <span>{formatRegistrationExpiry(vehicle.registrationExpiryDays)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">Vozila za servis</h2>
            <Badge variant="danger">{serviceRisk.length}</Badge>
          </div>
          <ul className="space-y-2">
            {serviceRisk.map((vehicle) => (
              <li key={vehicle.id} className="flex justify-between gap-3 border-b border-border/60 pb-2 text-sm last:border-0">
                <span>{vehicle.make} {vehicle.model} ({vehicle.plate})</span>
                <span className="data-font">{vehicle.serviceDueLabel}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-muted">Trošak po kategoriji</h2>
          <ul className="space-y-2">
            {Array.from(costByCategory.entries()).sort((a, b) => b[1] - a[1]).map(([label, total]) => (
              <li key={label} className="flex justify-between gap-3 border-b border-border/60 pb-2 text-sm last:border-0">
                <span>{label}</span>
                <span className="data-font">{formatAmount(total)} EUR</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-muted">Trošak po mjesecu</h2>
          <ul className="space-y-2">
            {Array.from(costByMonth.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([label, total]) => (
              <li key={label} className="flex justify-between gap-3 border-b border-border/60 pb-2 text-sm last:border-0">
                <span>{label}</span>
                <span className="data-font">{formatAmount(total)} EUR</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="xl:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-muted">Trošak po vozilu</h2>
          <div className="overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-[0.18em] text-muted">
                  <th className="py-2 pr-3">Vozilo</th>
                  <th className="py-2 text-right">Trošak</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(costByVehicle.entries()).sort((a, b) => b[1] - a[1]).map(([label, total]) => (
                  <tr key={label} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3">{label}</td>
                    <td className="py-2 text-right data-font">{formatAmount(total)} EUR</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-muted">Trošak goriva po mjesecu</h2>
          {fuelCostByMonth.size === 0 ? (
            <p className="text-sm text-muted">Nema zabilježenih unosa goriva.</p>
          ) : (
            <ul className="space-y-2">
              {Array.from(fuelCostByMonth.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([label, total]) => (
                <li key={label} className="flex justify-between gap-3 border-b border-border/60 pb-2 text-sm last:border-0">
                  <span>{label}</span>
                  <span className="data-font">{formatAmount(total)} EUR</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-muted">Trošak goriva po vozilu</h2>
          {fuelCostByVehicle.size === 0 ? (
            <p className="text-sm text-muted">Nema zabilježenih unosa goriva.</p>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-[0.18em] text-muted">
                    <th className="py-2 pr-3">Vozilo</th>
                    <th className="py-2 text-right">Trošak</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(fuelCostByVehicle.entries()).sort((a, b) => b[1] - a[1]).map(([label, total]) => (
                    <tr key={label} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3">{label}</td>
                      <td className="py-2 text-right data-font">{formatAmount(total)} EUR</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
