import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FallbackChip } from "@/components/dashboard/fallback-chip";
import { PageHeader } from "@/components/ui/page-header";
import { getOperationsOverviewData } from "@/lib/fleet/operations-service";

function formatDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

export default async function ZaduzenjaPage() {
  const operationsData = await getOperationsOverviewData();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Zaduženja"
        description="Operativni pregled aktivnih i povijesnih zaduženja vozila po zaposleniku."
        actions={
          <>
            <FallbackChip isUsingFallbackData={operationsData.isUsingFallbackData} />
            <Badge variant="info">Aktivno: {operationsData.metrics.activeAssignments}</Badge>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
              Aktivna zaduženja
            </h2>
            <Badge variant="primary">{operationsData.activeAssignments.length}</Badge>
          </div>

          {operationsData.activeAssignments.length === 0 ? (
            <p className="text-sm text-muted">Nema aktivnih zaduženja vozila.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-[0.2em] text-muted">
                    <th className="px-2 py-2">Zaposlenik</th>
                    <th className="px-2 py-2">Vozilo</th>
                    <th className="px-2 py-2">Od datuma</th>
                    <th className="px-2 py-2 text-right">KM start</th>
                    <th className="px-2 py-2 text-right">KM trenutno</th>
                    <th className="px-2 py-2 text-right">Delta</th>
                    <th className="px-2 py-2 text-right">Kvarovi</th>
                  </tr>
                </thead>
                <tbody>
                  {operationsData.activeAssignments.slice(0, 20).map((assignment) => (
                    <tr key={assignment.id} className="border-b border-border/60 last:border-0">
                      <td className="px-2 py-3">
                        <p className="font-medium text-slate-100">{assignment.employeeName}</p>
                        <p className="text-xs text-muted">@{assignment.employeeUsername}</p>
                      </td>
                      <td className="px-2 py-3">
                        <p className="font-medium text-slate-100">{assignment.vehicleLabel}</p>
                        <p className="text-xs text-muted">{assignment.plate}</p>
                      </td>
                      <td className="px-2 py-3 text-slate-300">{formatDate(assignment.startedAtIso)}</td>
                      <td className="px-2 py-3 text-right data-font text-slate-200">
                        {assignment.kmStart.toLocaleString("hr-HR")}
                      </td>
                      <td className="px-2 py-3 text-right data-font text-slate-200">
                        {assignment.currentVehicleKm.toLocaleString("hr-HR")}
                      </td>
                      <td className="px-2 py-3 text-right data-font text-cyan-200">
                        +{assignment.kmFromStart.toLocaleString("hr-HR")}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <Badge
                          variant={assignment.openFaultCount > 0 ? "warning" : "success"}
                          className="justify-center"
                        >
                          {assignment.openFaultCount}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
            Operativni snapshot
          </h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg border border-border bg-slate-950/55 px-3 py-2">
              <dt className="text-muted">Aktivna zaduženja</dt>
              <dd className="font-semibold text-slate-100">{operationsData.metrics.activeAssignments}</dd>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-slate-950/55 px-3 py-2">
              <dt className="text-muted">Otvoreni kvarovi</dt>
              <dd className="font-semibold text-amber-300">{operationsData.metrics.openFaults}</dd>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-slate-950/55 px-3 py-2">
              <dt className="text-muted">Kritični kvarovi</dt>
              <dd className="font-semibold text-rose-300">{operationsData.metrics.criticalFaults}</dd>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-slate-950/55 px-3 py-2">
              <dt className="text-muted">Otvoreni servisi</dt>
              <dd className="font-semibold text-sky-300">{operationsData.metrics.openServices}</dd>
            </div>
          </dl>

          <div className="mt-5 rounded-xl border border-border bg-slate-950/55 p-3 text-xs text-muted">
            Master kilometraža ostaje na razini vozila i automatski se ažurira kroz mobilne unose goriva i operativne tokove.
          </div>
        </Card>
      </div>
    </div>
  );
}
