import type { ServiceDueReason, ServiceDueType } from "@/lib/fleet/types";

const DEFAULT_SMALL_SERVICE_INTERVAL_KM = 15000;
const DEFAULT_LARGE_SERVICE_INTERVAL_KM = 100000;
const SMALL_SERVICE_INTERVAL_YEARS = 1;
const LARGE_SERVICE_INTERVAL_YEARS = 5;
export const SERVICE_ALERT_KM_THRESHOLD = 2000;

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
  smallServiceDueDays: number | null;
  largeServiceDueDays: number | null;
  serviceDueDays: number | null;
  isSmallServiceDue: boolean;
  isLargeServiceDue: boolean;
  isServiceDue: boolean;
  serviceDueType: ServiceDueType;
  dueReason: ServiceDueReason | null;
  serviceDueKm: number;
  serviceDueLabel: string;
  serviceProgressIntervalKm: number;
}

export function isVehicleServiceUrgent(params: {
  isServiceDue: boolean;
  serviceDueKm: number;
}) {
  return params.isServiceDue || params.serviceDueKm <= SERVICE_ALERT_KM_THRESHOLD;
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

function getDaysUntilDate(targetDate: Date, now: Date) {
  const dueDay = getDayStart(targetDate);
  const currentDay = getDayStart(now);
  const diffMs = dueDay.getTime() - currentDay.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function getServiceDueDays(
  lastServiceDateIso: string | null | undefined,
  intervalYears: number,
  now: Date,
) {
  const lastServiceDate = parseDate(lastServiceDateIso);

  if (!lastServiceDate) {
    return null;
  }

  const dueDate = addYears(lastServiceDate, intervalYears);
  return getDaysUntilDate(dueDate, now);
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

function resolveDueReason(isDueByKm: boolean, isDueByTime: boolean): ServiceDueReason | null {
  if (!isDueByKm && !isDueByTime) {
    return null;
  }

  if (isDueByKm && isDueByTime) {
    return "both";
  }

  if (isDueByKm) {
    return "km";
  }

  return "time";
}

function formatDueDays(days: number) {
  if (days < 0) {
    return `istekao prije ${Math.abs(days).toLocaleString("hr-HR")} dana`;
  }

  if (days === 0) {
    return "danas ističe";
  }

  return `ističe za ${days.toLocaleString("hr-HR")} dana`;
}

function buildDueLabel(
  serviceDueType: ServiceDueType,
  dueReason: ServiceDueReason | null,
  serviceDueKm: number,
  serviceDueDays: number | null,
  smallServiceDueKm: number,
  largeServiceDueKm: number,
) {
  if (serviceDueType === "mali") {
    if (dueReason === "time" && serviceDueDays !== null) {
      return `mali servis je potreban (${formatDueDays(serviceDueDays)})`;
    }

    if (dueReason === "both" && serviceDueDays !== null) {
      const kmPart =
        serviceDueKm < 0
          ? `kasni ${Math.abs(serviceDueKm).toLocaleString("hr-HR")} km`
          : `još ${smallServiceDueKm.toLocaleString("hr-HR")} km do intervala`;

      return `mali servis je potreban (${formatDueDays(serviceDueDays)}, ${kmPart})`;
    }

    if (serviceDueKm < 0) {
      return `mali servis kasni ${Math.abs(serviceDueKm).toLocaleString("hr-HR")} km`;
    }

    return "mali servis je sada potreban";
  }

  if (serviceDueType === "veliki") {
    if (dueReason === "time" && serviceDueDays !== null) {
      return `veliki servis je potreban (${formatDueDays(serviceDueDays)})`;
    }

    if (dueReason === "both" && serviceDueDays !== null) {
      const kmPart =
        serviceDueKm < 0
          ? `kasni ${Math.abs(serviceDueKm).toLocaleString("hr-HR")} km`
          : `još ${largeServiceDueKm.toLocaleString("hr-HR")} km do intervala`;

      return `veliki servis je potreban (${formatDueDays(serviceDueDays)}, ${kmPart})`;
    }

    if (serviceDueKm < 0) {
      return `veliki servis kasni ${Math.abs(serviceDueKm).toLocaleString("hr-HR")} km`;
    }

    return "veliki servis je sada potreban";
  }

  if (serviceDueType === "oba") {
    if (dueReason === "time" && serviceDueDays !== null) {
      return `mali i veliki servis su sada potrebni (${formatDueDays(serviceDueDays)})`;
    }

    if (dueReason === "both" && serviceDueDays !== null) {
      const kmParts = [
        smallServiceDueKm < 0
          ? `mali kasni ${Math.abs(smallServiceDueKm).toLocaleString("hr-HR")} km`
          : `mali: još ${smallServiceDueKm.toLocaleString("hr-HR")} km`,
        largeServiceDueKm < 0
          ? `veliki kasni ${Math.abs(largeServiceDueKm).toLocaleString("hr-HR")} km`
          : `veliki: još ${largeServiceDueKm.toLocaleString("hr-HR")} km`,
      ];

      return `mali i veliki servis su sada potrebni (${formatDueDays(serviceDueDays)}, ${kmParts.join(", ")})`;
    }

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
  const smallServiceDueDays = getServiceDueDays(
    input.lastSmallServiceDate,
    SMALL_SERVICE_INTERVAL_YEARS,
    now,
  );
  const largeServiceDueDays = getServiceDueDays(
    input.lastLargeServiceDate,
    LARGE_SERVICE_INTERVAL_YEARS,
    now,
  );
  const serviceDueDaysCandidates = [smallServiceDueDays, largeServiceDueDays].filter(
    (value): value is number => value !== null,
  );
  const serviceDueDays =
    serviceDueDaysCandidates.length > 0 ? Math.min(...serviceDueDaysCandidates) : null;

  const isSmallServiceDueByTime = smallServiceDueDays !== null && smallServiceDueDays <= 0;
  const isLargeServiceDueByTime = largeServiceDueDays !== null && largeServiceDueDays <= 0;

  const isSmallServiceDue = isSmallServiceDueByKm || isSmallServiceDueByTime;
  const isLargeServiceDue = isLargeServiceDueByKm || isLargeServiceDueByTime;
  const serviceDueType = resolveServiceDueType(isSmallServiceDue, isLargeServiceDue);
  const dueReason = resolveDueReason(
    isSmallServiceDueByKm || isLargeServiceDueByKm,
    isSmallServiceDueByTime || isLargeServiceDueByTime,
  );

  const serviceDueKm = Math.min(smallServiceDueKm, largeServiceDueKm);

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
    smallServiceDueDays,
    largeServiceDueDays,
    serviceDueDays,
    isSmallServiceDue,
    isLargeServiceDue,
    isServiceDue: isSmallServiceDue || isLargeServiceDue,
    serviceDueType,
    dueReason,
    serviceDueKm,
    serviceDueLabel: buildDueLabel(
      serviceDueType,
      dueReason,
      serviceDueKm,
      serviceDueDays,
      smallServiceDueKm,
      largeServiceDueKm,
    ),
    serviceProgressIntervalKm,
  };
}