export const ZAGREB_TIME_ZONE = "Europe/Zagreb";

function formatDatePartsInTimeZone(date: Date, timeZone = ZAGREB_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  });

  const parts = formatter.formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const year = parts.find((part) => part.type === "year")?.value;

  if (!day || !month || !year) {
    return null;
  }

  return { day, month, year };
}

export function getCurrentIsoTimestamp(date = new Date()) {
  return date.toISOString();
}

export function toDateOnlyInZagreb(date = new Date()) {
  const parts = formatDatePartsInTimeZone(date);

  if (!parts) {
    return getCurrentIsoTimestamp(date).slice(0, 10);
  }

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function parseDateForDisplay(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  // Supabase ponekad vraća timestamp bez timezone sufiksa; tretiramo ga kao UTC.
  const hasExplicitTimezone = /(Z|[+-]\d{2}:\d{2})$/i.test(normalized);
  const hasTimePart = /(?:T|\s)\d{2}:\d{2}/.test(normalized);
  const normalizedIso = normalized.includes(" ") ? normalized.replace(" ", "T") : normalized;
  const valueForParse = hasTimePart && !hasExplicitTimezone ? `${normalizedIso}Z` : normalizedIso;

  const parsed = new Date(valueForParse);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "N/A";
  }

  const parsed = parseDateForDisplay(value);

  if (!parsed) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: ZAGREB_TIME_ZONE,
  }).format(parsed);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "N/A";
  }

  const parsed = parseDateForDisplay(value);

  if (!parsed) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ZAGREB_TIME_ZONE,
  }).format(parsed);
}