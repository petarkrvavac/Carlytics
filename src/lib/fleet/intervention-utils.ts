const OPEN_INTERVENTION_HINTS = ["novo", "otvor", "cek", "ceka", "obrada", "pending", "active"];
const CLOSED_INTERVENTION_HINTS = ["zatvor", "rijes", "rije", "closed", "resolved", "done"];
const IN_PROGRESS_INTERVENTION_HINTS = ["u_obradi", "obradi", "obrada", "in_progress", "in progress"];

type QueryWithSoftDeleteFilters<T> = {
  neq: (column: string, value: boolean) => T;
  is: (column: string, value: null) => T;
};

function normalizeEnvColumn(value: string | undefined) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

const SOFT_DELETE_BOOLEAN_COLUMN = normalizeEnvColumn(
  process.env.CARLYTICS_INTERVENTIONS_SOFT_DELETE_BOOLEAN_COLUMN,
);
const SOFT_DELETE_TIMESTAMP_COLUMN = normalizeEnvColumn(
  process.env.CARLYTICS_INTERVENTIONS_SOFT_DELETE_TIMESTAMP_COLUMN,
);

export function isInterventionOpen(status: string | null, endedAt: string | null | undefined) {
  if (endedAt) {
    return false;
  }

  if (!status) {
    return true;
  }

  const normalized = status.toLowerCase();

  if (CLOSED_INTERVENTION_HINTS.some((hint) => normalized.includes(hint))) {
    return false;
  }

  if (OPEN_INTERVENTION_HINTS.some((hint) => normalized.includes(hint))) {
    return true;
  }

  return true;
}

export function isInterventionInProgress(status: string | null) {
  if (!status) {
    return false;
  }

  const normalized = status.toLowerCase();
  return IN_PROGRESS_INTERVENTION_HINTS.some((hint) => normalized.includes(hint));
}

export function applyInterventionVisibilityFilter<T extends QueryWithSoftDeleteFilters<T>>(
  query: T,
) {
  let filteredQuery = query;

  if (SOFT_DELETE_BOOLEAN_COLUMN) {
    filteredQuery = filteredQuery.neq(SOFT_DELETE_BOOLEAN_COLUMN, true);
  }

  if (SOFT_DELETE_TIMESTAMP_COLUMN) {
    filteredQuery = filteredQuery.is(SOFT_DELETE_TIMESTAMP_COLUMN, null);
  }

  return filteredQuery;
}