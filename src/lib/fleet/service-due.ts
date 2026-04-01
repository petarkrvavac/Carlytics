import type { ServiceDueType } from "@/lib/fleet/types";

const DEFAULT_SMALL_SERVICE_INTERVAL_KM = 15000;
const DEFAULT_LARGE_SERVICE_INTERVAL_KM = 100000;
const SMALL_SERVICE_INTERVAL_YEARS = 1;
const LARGE_SERVICE_INTERVAL_YEARS = 5;

interface EvaluateVehicleServiceDueInput {
  currentKm: number | null | undefined;
  lastSmallServiceKm: number | null | undefined;
  lastLargeServiceKm: number | null | undefined;
  smallServiceIntervalKm: number | null | undefined;
  largeServiceIntervalKm: number | null | undefined;
  lastSmallServiceDate: string | null | undefined;
  lastLargeServiceDate: string | null | undefined;
  now?: Date;
}

export interface VehicleServiceDueSummary {
  smallServiceIntervalKm: number;
  largeServiceIntervalKm: number;
  smallServiceDueKm: number;
  largeServiceDueKm: number;
  isSmallServiceDue: boolean;
  isLargeServiceDue: boolean;
  isServiceDue: boolean;
  serviceDueType: ServiceDueType;
  serviceDueKm: number;
  serviceDueLabel: string;
  serviceProgressIntervalKm: number;
}

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function addYears(baseDate: Date, years: number) {
  return new Date(
    baseDate.getFullYear() + years,
    baseDate.getMonth(),
    baseDate.getDate(),
  );
}

function getDayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isDueByTime(
  lastServiceDateIso: string | null | undefined,
  intervalYears: number,
  now: Date,
) {
  const lastServiceDate = parseDate(lastServiceDateIso);

  if (!lastServiceDate) {
    return false;
  }

  const dueDate = addYears(lastServiceDate, intervalYears);
  return getDayStart(dueDate).getTime() <= getDayStart(now).getTime();
}

function toIntervalKm(
  intervalKm: number | null | undefined,
  fallbackIntervalKm: number,
) {
  if (!intervalKm || intervalKm <= 0) {
    return fallbackIntervalKm;
  }

  return Math.round(intervalKm);
}

function toPositiveKm(value: number | null | undefined) {
  if (!value || value < 0) {
    return 0;
  }

  return Math.round(value);
}

function resolveServiceDueType(
  isSmallServiceDue: boolean,
  isLargeServiceDue: boolean,
): ServiceDueType {
  if (isSmallServiceDue && isLargeServiceDue) {
    return "oba";
  }

  if (isSmallServiceDue) {
    return "mali";
  }

  if (isLargeServiceDue) {
    return "veliki";
  }

  return "none";
}

function buildDueLabel(
  serviceDueType: ServiceDueType,
  serviceDueKm: number,
  smallServiceDueKm: number,
  largeServiceDueKm: number,
) {
  if (serviceDueType === "mali") {
    if (serviceDueKm < 0) {
      return `mali servis kasni ${Math.abs(serviceDueKm).toLocaleString("hr-HR")} km`;
    }

    return "mali servis je sada potreban";
  }

  if (serviceDueType === "veliki") {
    if (serviceDueKm < 0) {
      return `veliki servis kasni ${Math.abs(serviceDueKm).toLocaleString("hr-HR")} km`;
    }

    return "veliki servis je sada potreban";
  }

  if (serviceDueType === "oba") {
    const smallOverdue = smallServiceDueKm < 0 ? Math.abs(smallServiceDueKm) : 0;
    const largeOverdue = largeServiceDueKm < 0 ? Math.abs(largeServiceDueKm) : 0;

    if (smallOverdue > 0 || largeOverdue > 0) {
      const overdueParts = [
        smallOverdue > 0 ? `mali kasni ${smallOverdue.toLocaleString("hr-HR")} km` : "",
        largeOverdue > 0 ? `veliki kasni ${largeOverdue.toLocaleString("hr-HR")} km` : "",
      ].filter(Boolean);

      return `mali i veliki servis su sada potrebni (${overdueParts.join(", ")})`;
    }

    return "mali i veliki servis su sada potrebni";
  }

  const nextServiceType = smallServiceDueKm <= largeServiceDueKm ? "malog" : "velikog";
  const nextKm = Math.max(0, Math.round(Math.min(smallServiceDueKm, largeServiceDueKm)));

  return `${nextKm.toLocaleString("hr-HR")} km do ${nextServiceType} servisa`;
}

export function evaluateVehicleServiceDue(
  input: EvaluateVehicleServiceDueInput,
): VehicleServiceDueSummary {
  const now = input.now ?? new Date();
  const currentKm = toPositiveKm(input.currentKm);
  const smallServiceIntervalKm = toIntervalKm(
    input.smallServiceIntervalKm,
    DEFAULT_SMALL_SERVICE_INTERVAL_KM,
  );
  const largeServiceIntervalKm = toIntervalKm(
    input.largeServiceIntervalKm,
    DEFAULT_LARGE_SERVICE_INTERVAL_KM,
  );
  const lastSmallServiceKm = toPositiveKm(input.lastSmallServiceKm);
  const lastLargeServiceKm = toPositiveKm(input.lastLargeServiceKm);

  const smallServiceDueKm = smallServiceIntervalKm - (currentKm - lastSmallServiceKm);
  const largeServiceDueKm = largeServiceIntervalKm - (currentKm - lastLargeServiceKm);

  const isSmallServiceDueByKm = smallServiceDueKm <= 0;
  const isLargeServiceDueByKm = largeServiceDueKm <= 0;
  const isSmallServiceDueByTime = isDueByTime(
    input.lastSmallServiceDate,
    SMALL_SERVICE_INTERVAL_YEARS,
    now,
  );
  const isLargeServiceDueByTime = isDueByTime(
    input.lastLargeServiceDate,
    LARGE_SERVICE_INTERVAL_YEARS,
    now,
  );

  const isSmallServiceDue = isSmallServiceDueByKm || isSmallServiceDueByTime;
  const isLargeServiceDue = isLargeServiceDueByKm || isLargeServiceDueByTime;
  const serviceDueType = resolveServiceDueType(isSmallServiceDue, isLargeServiceDue);

  const overdueByKmCandidates = [
    isSmallServiceDueByKm ? smallServiceDueKm : Number.POSITIVE_INFINITY,
    isLargeServiceDueByKm ? largeServiceDueKm : Number.POSITIVE_INFINITY,
  ].filter((value) => Number.isFinite(value));

  const serviceDueKm =
    serviceDueType === "none"
      ? Math.min(smallServiceDueKm, largeServiceDueKm)
      : overdueByKmCandidates.length > 0
        ? Math.min(...overdueByKmCandidates)
        : 0;

  const serviceProgressIntervalKm =
    serviceDueType === "mali"
      ? smallServiceIntervalKm
      : serviceDueType === "veliki"
        ? largeServiceIntervalKm
        : serviceDueType === "oba"
          ? Math.min(smallServiceIntervalKm, largeServiceIntervalKm)
          : smallServiceDueKm <= largeServiceDueKm
            ? smallServiceIntervalKm
            : largeServiceIntervalKm;

  return {
    smallServiceIntervalKm,
    largeServiceIntervalKm,
    smallServiceDueKm,
    largeServiceDueKm,
    isSmallServiceDue,
    isLargeServiceDue,
    isServiceDue: isSmallServiceDue || isLargeServiceDue,
    serviceDueType,
    serviceDueKm,
    serviceDueLabel: buildDueLabel(
      serviceDueType,
      serviceDueKm,
      smallServiceDueKm,
      largeServiceDueKm,
    ),
    serviceProgressIntervalKm,
  };
}