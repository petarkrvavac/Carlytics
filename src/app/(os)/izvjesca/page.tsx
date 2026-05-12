import Link from "next/link";
import { Download } from "lucide-react";

import { PrintReportButton } from "@/components/reports/print-report-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getFleetVehiclesSnapshot } from "@/lib/fleet/dashboard-service";
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

export default async function IzvjescaPage() {
  const [vehicles, serviceData, operationsData] = await Promise.all([
    getFleetVehiclesSnapshot(),
    getServiceCenterTimelineData(),
    getOperationsOverviewData(),
  ]);

  const activeVehicles = vehicles.filter((vehicle) => vehicle.isActive);
  const registrationRisk = activeVehicles.filter(
    (vehicle) => vehicle.registrationExpiryDays !== null && vehicle.registrationExpiryDays <= 30,
  );
  const serviceRisk = activeVehicles.filter(
    (vehicle) => vehicle.isServiceDue || vehicle.serviceDueKm <= 2000,
  );
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
                <span className="data-font">{vehicle.registrationExpiryDays} dana</span>
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
