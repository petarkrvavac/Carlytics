import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FallbackChip } from "@/components/dashboard/fallback-chip";
import { DesktopActiveAssignmentsTable } from "@/components/assignments/desktop-active-assignments-table";
import { PageHeader } from "@/components/ui/page-header";
import { ServerPagination } from "@/components/ui/server-pagination";
import { getOperationsOverviewData } from "@/lib/fleet/operations-service";
import { formatDate } from "@/lib/utils/date-format";
import { parsePageParam } from "@/lib/utils/page-params";

interface ZaduzenjaPageProps {
  searchParams?: Promise<{
    od?: string;
    do?: string;
    aktivna?: string;
    povijest?: string;
    prikaz?: string;
  }>;
}

const ITEMS_PER_PAGE = 10;
type ZaduzenjaView = "aktivna" | "povijest";

function parseDateInput(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function parseViewInput(value: string | undefined): ZaduzenjaView {
  if (value === "povijest") {
    return "povijest";
  }

  return "aktivna";
}

function buildZaduzenjaHref(params: {
  od?: string;
  do?: string;
  aktivna?: number;
  povijest?: number;
  prikaz?: ZaduzenjaView;
}) {
  const query = new URLSearchParams();

  if (params.prikaz === "povijest") {
    query.set("prikaz", "povijest");
  }

  if (params.od) {
    query.set("od", params.od);
  }

  if (params.do) {
    query.set("do", params.do);
  }

  if (params.aktivna && params.aktivna > 1) {
    query.set("aktivna", String(params.aktivna));
  }

  if (params.povijest && params.povijest > 1) {
    query.set("povijest", String(params.povijest));
  }

  const queryString = query.toString();

  return queryString ? `/zaduzenja?${queryString}` : "/zaduzenja";
}

function isInDateRange(dateIso: string, fromRaw: string | undefined, toRaw: string | undefined) {
  const target = new Date(dateIso);

  if (Number.isNaN(target.getTime())) {
    return false;
  }

  const fromDate = parseDateInput(fromRaw);
  const toDate = parseDateInput(toRaw);

  if (fromDate && target < fromDate) {
    return false;
  }

  if (toDate) {
    const toDateEnd = new Date(toDate);
    toDateEnd.setHours(23, 59, 59, 999);

    if (target > toDateEnd) {
      return false;
    }
  }

  return true;
}

export default async function ZaduzenjaPage({ searchParams }: ZaduzenjaPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const operationsData = await getOperationsOverviewData();
  const selectedView = parseViewInput(resolvedSearchParams?.prikaz);
  const activePage = parsePageParam(resolvedSearchParams?.aktivna);
  const historyPage = parsePageParam(resolvedSearchParams?.povijest);

  const filteredHistory = operationsData.assignmentHistory.filter((assignment) =>
    isInDateRange(assignment.startedAtIso, resolvedSearchParams?.od, resolvedSearchParams?.do),
  );

  const activeTotalPages = Math.max(
    1,
    Math.ceil(operationsData.activeAssignments.length / ITEMS_PER_PAGE),
  );
  const historyTotalPages = Math.max(1, Math.ceil(filteredHistory.length / ITEMS_PER_PAGE));
  const safeActivePage = Math.min(activePage, activeTotalPages);
  const safeHistoryPage = Math.min(historyPage, historyTotalPages);

  const pagedActiveAssignments = operationsData.activeAssignments.slice(
    (safeActivePage - 1) * ITEMS_PER_PAGE,
    safeActivePage * ITEMS_PER_PAGE,
  );

  const pagedHistory = filteredHistory.slice(
    (safeHistoryPage - 1) * ITEMS_PER_PAGE,
    safeHistoryPage * ITEMS_PER_PAGE,
  );

  const activePageHref = (page: number) =>
    buildZaduzenjaHref({
      od: resolvedSearchParams?.od,
      do: resolvedSearchParams?.do,
      aktivna: page,
      povijest: safeHistoryPage,
      prikaz: "aktivna",
    });

  const historyPageHref = (page: number) =>
    buildZaduzenjaHref({
      od: resolvedSearchParams?.od,
      do: resolvedSearchParams?.do,
      aktivna: safeActivePage,
      povijest: page,
      prikaz: "povijest",
    });

  const activeViewHref = buildZaduzenjaHref({
    od: resolvedSearchParams?.od,
    do: resolvedSearchParams?.do,
    aktivna: safeActivePage,
    povijest: safeHistoryPage,
    prikaz: "aktivna",
  });

  const historyViewHref = buildZaduzenjaHref({
    od: resolvedSearchParams?.od,
    do: resolvedSearchParams?.do,
    aktivna: safeActivePage,
    povijest: safeHistoryPage,
    prikaz: "povijest",
  });

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

      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={activeViewHref}
            className={`inline-flex h-8 items-center rounded-lg border px-3 text-xs font-semibold uppercase tracking-[0.14em] transition ${
              selectedView === "aktivna"
                ? "border-cyan-300 bg-cyan-400 text-slate-950"
                : "border-border bg-surface text-foreground hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200"
            }`}
          >
            Aktivna zaduženja
          </Link>

          <Link
            href={historyViewHref}
            className={`inline-flex h-8 items-center rounded-lg border px-3 text-xs font-semibold uppercase tracking-[0.14em] transition ${
              selectedView === "povijest"
                ? "border-cyan-300 bg-cyan-400 text-slate-950"
                : "border-border bg-surface text-foreground hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200"
            }`}
          >
            Povijest zaduženja
          </Link>
        </div>

        {selectedView === "aktivna" ? (
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
              <>
                <DesktopActiveAssignmentsTable assignments={pagedActiveAssignments} />
                <ServerPagination
                  currentPage={safeActivePage}
                  totalPages={activeTotalPages}
                  hrefForPage={activePageHref}
                />
              </>
            )}
          </Card>
        ) : (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
                Povijest zaduženja
              </h3>

              <form method="get" className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface px-3 py-2">
                <input type="hidden" name="prikaz" value="povijest" />
                <input type="hidden" name="aktivna" value={String(safeActivePage)} />
                <input type="hidden" name="povijest" value="1" />
                <label className="text-[11px] uppercase tracking-[0.16em] text-muted">
                  Od
                  <input
                    type="date"
                    name="od"
                    defaultValue={resolvedSearchParams?.od ?? ""}
                    className="mt-1 block rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                  />
                </label>
                <label className="text-[11px] uppercase tracking-[0.16em] text-muted">
                  Do
                  <input
                    type="date"
                    name="do"
                    defaultValue={resolvedSearchParams?.do ?? ""}
                    className="mt-1 block rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                  />
                </label>
                <button
                  type="submit"
                  className="inline-flex h-8 items-center rounded-lg border border-cyan-300 bg-cyan-400 px-3 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Primijeni
                </button>
                <Link
                  href={buildZaduzenjaHref({
                    prikaz: "povijest",
                    aktivna: safeActivePage,
                  })}
                  className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200"
                >
                  Očisti
                </Link>
              </form>
            </div>

            {filteredHistory.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Nema zaduženja za odabrani period.</p>
            ) : (
              <>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-[0.2em] text-muted">
                        <th className="px-2 py-2">Početak</th>
                        <th className="px-2 py-2">Završetak</th>
                        <th className="px-2 py-2">Status</th>
                        <th className="px-2 py-2">Zaposlenik</th>
                        <th className="px-2 py-2">Vozilo</th>
                        <th className="px-2 py-2 text-right">KM start</th>
                        <th className="px-2 py-2 text-right">KM kraj</th>
                        <th className="px-2 py-2 text-right">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedHistory.map((assignment) => (
                        <tr key={assignment.id} className="border-b border-border/60 last:border-0">
                          <td className="px-2 py-3 text-slate-300">{formatDate(assignment.startedAtIso)}</td>
                          <td className="px-2 py-3 text-slate-300">{formatDate(assignment.endedAtIso)}</td>
                          <td className="px-2 py-3">
                            <Badge variant={assignment.isActive ? "warning" : "success"}>
                              {assignment.isActive ? "Aktivno" : "Zatvoreno"}
                            </Badge>
                          </td>
                          <td className="px-2 py-3">
                            <p className="font-medium text-slate-100">{assignment.employeeName}</p>
                            <p className="text-xs text-muted">@{assignment.employeeUsername}</p>
                          </td>
                          <td className="px-2 py-3">
                            <p className="font-medium text-slate-100">{assignment.vehicleLabel}</p>
                            <p className="text-xs text-muted">{assignment.plate}</p>
                          </td>
                          <td className="px-2 py-3 text-right data-font text-slate-200">
                            {assignment.kmStart.toLocaleString("hr-HR")}
                          </td>
                          <td className="px-2 py-3 text-right data-font text-slate-200">
                            {(assignment.kmEnd ?? assignment.currentVehicleKm).toLocaleString("hr-HR")}
                          </td>
                          <td className="px-2 py-3 text-right data-font text-cyan-200">
                            +{assignment.distanceKm.toLocaleString("hr-HR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ServerPagination
                  currentPage={safeHistoryPage}
                  totalPages={historyTotalPages}
                  hrefForPage={historyPageHref}
                />
              </>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
