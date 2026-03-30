import Link from "next/link";

import { FallbackChip } from "@/components/dashboard/fallback-chip";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getOperationsOverviewData } from "@/lib/fleet/operations-service";

function formatDateTime(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export default async function GorivoPage() {
  const operationsData = await getOperationsOverviewData();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Gorivo"
        description="Kontrola troška i validacija unosa goriva prema kapacitetu rezervoara i trenutačnoj kilometraži vozila."
        actions={
          <>
            <FallbackChip isUsingFallbackData={operationsData.isUsingFallbackData} />
            <Link
              href="/m/gorivo"
              className="inline-flex h-10 items-center rounded-xl border border-cyan-500/35 bg-cyan-500/15 px-4 text-sm font-medium text-cyan-200 transition hover:border-cyan-400/70 hover:bg-cyan-500/20"
            >
              Mobilni unos goriva
            </Link>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Unosi (30d)</p>
          <p className="mt-3 data-font text-3xl text-cyan-200">{operationsData.metrics.fuelEntries30d}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Litara (30d)</p>
          <p className="mt-3 data-font text-3xl text-slate-100">
            {operationsData.metrics.liters30d.toLocaleString("hr-HR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Trošak (30d)</p>
          <p className="mt-3 data-font text-3xl text-amber-200">
            {operationsData.metrics.fuelCost30d.toLocaleString("hr-HR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            <span className="ml-1 text-sm text-amber-300">EUR</span>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Prosjek EUR/L</p>
          <p className="mt-3 data-font text-3xl text-sky-200">
            {operationsData.metrics.averageFuelPrice30d.toLocaleString("hr-HR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </Card>
      </section>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
            Recent fuel ledger
          </h2>
          <Badge variant="info">Zapisa: {operationsData.fuelLedger.length}</Badge>
        </div>

        {operationsData.fuelLedger.length === 0 ? (
          <p className="text-sm text-muted">Nema zabilježenih unosa goriva.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-[0.2em] text-muted">
                  <th className="px-2 py-2">Datum</th>
                  <th className="px-2 py-2">Vozilo</th>
                  <th className="px-2 py-2">Zaposlenik</th>
                  <th className="px-2 py-2 text-right">KM</th>
                  <th className="px-2 py-2 text-right">L</th>
                  <th className="px-2 py-2 text-right">EUR/L</th>
                  <th className="px-2 py-2 text-right">Ukupno</th>
                </tr>
              </thead>
              <tbody>
                {operationsData.fuelLedger.slice(0, 18).map((entry) => (
                  <tr key={entry.id} className="border-b border-border/60 last:border-0">
                    <td className="px-2 py-3 text-slate-300">{formatDateTime(entry.dateIso)}</td>
                    <td className="px-2 py-3">
                      <p className="font-medium text-slate-100">{entry.vehicleLabel}</p>
                      <p className="text-xs text-muted">{entry.plate}</p>
                    </td>
                    <td className="px-2 py-3 text-slate-300">{entry.employeeName}</td>
                    <td className="px-2 py-3 text-right data-font text-slate-200">
                      {entry.kmAtFill.toLocaleString("hr-HR")}
                    </td>
                    <td className="px-2 py-3 text-right data-font text-slate-200">
                      {entry.liters.toLocaleString("hr-HR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-2 py-3 text-right data-font text-slate-200">
                      {entry.pricePerLiter.toLocaleString("hr-HR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-2 py-3 text-right data-font text-amber-200">
                      {entry.totalAmount.toLocaleString("hr-HR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
