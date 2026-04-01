import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { FallbackChip } from "@/components/dashboard/fallback-chip";
import { EmployeeKmChart } from "@/components/employees/employee-km-chart";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireSessionUser } from "@/lib/auth/session";
import { getEmployeeOperationalInsights } from "@/lib/employees/employee-service";

interface ZaposlenikDetaljiPageProps {
  params: Promise<{ id: string }>;
}

function parseEmployeeId(rawId: string) {
  const parsed = Number(rawId);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

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

function formatDate(value: string | null) {
  if (!value) {
    return "N/A";
  }

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

function getFaultStatusVariant(statusLabel: string) {
  const normalized = statusLabel.toLowerCase();

  if (
    normalized.includes("zat") ||
    normalized.includes("rije") ||
    normalized.includes("rijes") ||
    normalized.includes("closed") ||
    normalized.includes("res")
  ) {
    return "success" as const;
  }

  if (normalized.includes("obr")) {
    return "warning" as const;
  }

  return "danger" as const;
}

export default async function ZaposlenikDetaljiPage({ params }: ZaposlenikDetaljiPageProps) {
  await requireSessionUser({
    allowedRoles: ["admin", "voditelj_flote"],
    redirectTo: "/prijava",
    forbiddenRedirectTo: "/m",
  });

  const { id } = await params;
  const employeeId = parseEmployeeId(id);

  if (!employeeId) {
    notFound();
  }

  const insights = await getEmployeeOperationalInsights(employeeId);

  if (!insights.employee) {
    notFound();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${insights.employee.firstName} ${insights.employee.lastName}`}
        description="Detaljni pregled aktivnosti zaposlenika: kvarovi, gorivo, zaduženja i kilometraža."
        actions={
          <>
            <FallbackChip isUsingFallbackData={insights.isUsingFallbackData} />
            <Badge variant="info">Uloga: {insights.employee.role}</Badge>
            <Link
              href="/zaposlenici"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200"
            >
              <ArrowLeft size={15} />
              Natrag
            </Link>
          </>
        }
      />

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
            Prijeđeni kilometri
          </h2>
          <Badge variant="neutral">Zadnjih 6 mjeseci</Badge>
        </div>
        <EmployeeKmChart series={insights.monthlyKmSeries} />
      </Card>

      <section className="grid gap-5 xl:grid-cols-3">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
              Zadnja 3 kvara
            </h2>
            <Badge variant="warning">{insights.recentFaults.length}</Badge>
          </div>

          {insights.recentFaults.length === 0 ? (
            <p className="text-sm text-muted">Nema prijava kvarova za odabranog zaposlenika.</p>
          ) : (
            <ul className="space-y-3">
              {insights.recentFaults.map((fault) => (
                <li key={fault.id} className="rounded-xl border border-border bg-surface px-3 py-3">
                  <p className="text-sm font-medium text-slate-100">{fault.description}</p>
                  <p className="mt-1 text-xs text-muted">
                    {fault.vehicleLabel} ({fault.plate})
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="neutral">{fault.priority}</Badge>
                    <Badge variant={getFaultStatusVariant(fault.status)}>{fault.status}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted">{formatDateTime(fault.reportedAtIso)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
              Zadnja 3 točenja
            </h2>
            <Badge variant="info">{insights.recentFuelEntries.length}</Badge>
          </div>

          {insights.recentFuelEntries.length === 0 ? (
            <p className="text-sm text-muted">Nema unosa goriva za odabranog zaposlenika.</p>
          ) : (
            <ul className="space-y-3">
              {insights.recentFuelEntries.map((fuel) => (
                <li key={fuel.id} className="rounded-xl border border-border bg-surface px-3 py-3">
                  <p className="text-sm font-medium text-slate-100">
                    {fuel.vehicleLabel} ({fuel.plate})
                  </p>
                  <p className="mt-1 text-xs text-muted">{formatDateTime(fuel.dateIso)}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted">
                    <p>
                      KM: <span className="data-font text-slate-200">{fuel.kmAtFill.toLocaleString("hr-HR")}</span>
                    </p>
                    <p>
                      L: <span className="data-font text-slate-200">{fuel.liters.toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </p>
                    <p>
                      EUR/L: <span className="data-font text-slate-200">{fuel.pricePerLiter.toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </p>
                    <p>
                      Ukupno: <span className="data-font text-amber-200">{fuel.totalAmount.toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
              Zadnja 3 zaduženja
            </h2>
            <Badge variant="neutral">{insights.recentAssignments.length}</Badge>
          </div>

          {insights.recentAssignments.length === 0 ? (
            <p className="text-sm text-muted">Nema zaduženja za odabranog zaposlenika.</p>
          ) : (
            <ul className="space-y-3">
              {insights.recentAssignments.map((assignment) => (
                <li key={assignment.id} className="rounded-xl border border-border bg-surface px-3 py-3">
                  <p className="text-sm font-medium text-slate-100">
                    {assignment.vehicleLabel} ({assignment.plate})
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {formatDate(assignment.startedAtIso)} - {formatDate(assignment.endedAtIso)}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted">
                    <p>
                      KM start: <span className="data-font text-slate-200">{assignment.kmStart.toLocaleString("hr-HR")}</span>
                    </p>
                    <p>
                      KM kraj: <span className="data-font text-slate-200">{assignment.kmEnd.toLocaleString("hr-HR")}</span>
                    </p>
                    <p className="col-span-2">
                      Delta: <span className="data-font text-cyan-200">+{assignment.distanceKm.toLocaleString("hr-HR")} km</span>
                    </p>
                  </div>
                  <div className="mt-2">
                    <Badge variant={assignment.isActive ? "warning" : "success"}>
                      {assignment.isActive ? "Aktivno" : "Zatvoreno"}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
