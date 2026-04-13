"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ServerPagination } from "@/components/ui/server-pagination";
import type {
  VehicleRegistrationHistoryItem,
  VehicleTireHistoryItem,
} from "@/lib/fleet/vehicle-digital-twin-service";
import { formatDate } from "@/lib/utils/date-format";
import { replaceCurrentUrlQueryParams } from "@/lib/utils/url-query";

interface VehicleHistoryPaginationSectionsProps {
  tireHistory: VehicleTireHistoryItem[];
  registrationHistory: VehicleRegistrationHistoryItem[];
  initialTirePage: number;
  initialRegistrationPage: number;
  tireItemsPerPage: number;
  registrationItemsPerPage: number;
}

function formatAmount(value: number) {
  return value.toLocaleString("hr-HR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getRegistrationHistoryStatus(expiryDateIso: string, isLatestRecord: boolean) {
  if (!isLatestRecord) {
    return null;
  }

  const expiryDate = new Date(expiryDateIso);

  if (Number.isNaN(expiryDate.getTime())) {
    return {
      label: "Status nepoznat",
      variant: "neutral" as const,
    };
  }

  const now = new Date();
  const midnightNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const midnightExpiry = new Date(
    expiryDate.getFullYear(),
    expiryDate.getMonth(),
    expiryDate.getDate(),
  );

  const daysUntilExpiry = Math.ceil(
    (midnightExpiry.getTime() - midnightNow.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysUntilExpiry < 0) {
    return {
      label: `Istekla prije ${Math.abs(daysUntilExpiry)} dana`,
      variant: "danger" as const,
    };
  }

  if (daysUntilExpiry <= 30) {
    return {
      label: `Ističe za ${daysUntilExpiry} dana`,
      variant: "warning" as const,
    };
  }

  return {
    label: `Aktivna još ${daysUntilExpiry} dana`,
    variant: "success" as const,
  };
}

export function VehicleHistoryPaginationSections({
  tireHistory,
  registrationHistory,
  initialTirePage,
  initialRegistrationPage,
  tireItemsPerPage,
  registrationItemsPerPage,
}: VehicleHistoryPaginationSectionsProps) {
  const [tirePage, setTirePage] = useState(initialTirePage);
  const [registrationPage, setRegistrationPage] = useState(initialRegistrationPage);

  const sortedRegistrationHistory = useMemo(() => {
    return [...registrationHistory].sort((left, right) => {
      const leftTime = new Date(left.registrationDateIso).getTime();
      const rightTime = new Date(right.registrationDateIso).getTime();
      const safeLeftTime = Number.isNaN(leftTime) ? 0 : leftTime;
      const safeRightTime = Number.isNaN(rightTime) ? 0 : rightTime;

      return safeRightTime - safeLeftTime;
    });
  }, [registrationHistory]);

  const totalTirePages = Math.max(1, Math.ceil(tireHistory.length / tireItemsPerPage));
  const totalRegistrationPages = Math.max(
    1,
    Math.ceil(sortedRegistrationHistory.length / registrationItemsPerPage),
  );

  const safeTirePage = Math.min(Math.max(tirePage, 1), totalTirePages);
  const safeRegistrationPage = Math.min(
    Math.max(registrationPage, 1),
    totalRegistrationPages,
  );

  const pagedTireHistory = tireHistory.slice(
    (safeTirePage - 1) * tireItemsPerPage,
    safeTirePage * tireItemsPerPage,
  );

  const pagedRegistrationHistory = sortedRegistrationHistory.slice(
    (safeRegistrationPage - 1) * registrationItemsPerPage,
    safeRegistrationPage * registrationItemsPerPage,
  );

  useEffect(() => {
    replaceCurrentUrlQueryParams({
      gume: safeTirePage > 1 ? String(safeTirePage) : null,
      registracije: safeRegistrationPage > 1 ? String(safeRegistrationPage) : null,
    });
  }, [safeRegistrationPage, safeTirePage]);

  return (
    <>
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
            Evidencija guma
          </h2>
          <Badge variant="info">Zapisa: {tireHistory.length}</Badge>
        </div>

        {tireHistory.length === 0 ? (
          <p className="text-sm text-muted">Nema evidentiranih kupovina guma za ovo vozilo.</p>
        ) : (
          <>
            <ul className="space-y-3">
              {pagedTireHistory.map((tireEntry) => (
                <li key={tireEntry.id} className="rounded-xl border border-border bg-surface px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-100">
                      {tireEntry.manufacturer ?? "Nepoznat proizvođač"}
                    </p>
                    <div className="flex gap-2">
                      <Badge variant="neutral">{tireEntry.season ?? "Sezona N/A"}</Badge>
                      {tireEntry.cost !== null ? (
                        <Badge variant="warning">{formatAmount(tireEntry.cost)} EUR</Badge>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    Datum kupovine: {tireEntry.purchaseDateIso ? formatDate(tireEntry.purchaseDateIso) : "N/A"}
                  </p>
                </li>
              ))}
            </ul>

            <ServerPagination
              currentPage={safeTirePage}
              totalPages={totalTirePages}
              showWhenSinglePage
              onPageChange={setTirePage}
            />
          </>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
            Povijest registracija
          </h2>
          <Badge variant="info">Zapisa: {registrationHistory.length}</Badge>
        </div>

        {registrationHistory.length === 0 ? (
          <p className="text-sm text-muted">Nema evidentiranih registracija za ovo vozilo.</p>
        ) : (
          <>
            <ul className="space-y-3">
              {pagedRegistrationHistory.map((registration, index) => {
                const absoluteIndex = (safeRegistrationPage - 1) * registrationItemsPerPage + index;
                const registrationStatus = getRegistrationHistoryStatus(
                  registration.expiryDateIso,
                  absoluteIndex === 0,
                );

                return (
                  <li
                    key={registration.id}
                    className="rounded-xl border border-border bg-surface px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-100">
                        {registration.registrationPlate}
                      </p>
                      {registrationStatus ? (
                        <Badge variant={registrationStatus.variant}>{registrationStatus.label}</Badge>
                      ) : null}
                    </div>

                    <div className="mt-2 grid gap-1 text-xs text-muted">
                      <p>
                        Datum registracije:{" "}
                        <span className="text-slate-200">
                          {formatDate(registration.registrationDateIso)}
                        </span>
                      </p>
                      <p>
                        Datum isteka:{" "}
                        <span className="text-slate-200">
                          {formatDate(registration.expiryDateIso)}
                        </span>
                      </p>
                      <p>
                        Cijena:{" "}
                        <span className="data-font text-amber-200">
                          {registration.cost === null
                            ? "N/A"
                            : `${formatAmount(registration.cost)} EUR`}
                        </span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <ServerPagination
              currentPage={safeRegistrationPage}
              totalPages={totalRegistrationPages}
              showWhenSinglePage
              onPageChange={setRegistrationPage}
            />
          </>
        )}
      </Card>
    </>
  );
}
