function normalizeCategoryLabel(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function isRegularServiceCategoryLabel(categoryLabel: string | null | undefined) {
  const normalized = normalizeCategoryLabel(categoryLabel);

  if (!normalized) {
    return false;
  }

  if (normalized.includes("kvar") || normalized.includes("izvanred")) {
    return false;
  }

  if (
    normalized.includes("redovni") ||
    normalized.includes("odrzavanje") ||
    normalized.includes("preventiv")
  ) {
    return true;
  }

  const hasSmallOrLarge = normalized.includes("mali") || normalized.includes("veliki");

  if (hasSmallOrLarge && normalized.includes("servis")) {
    return true;
  }

  return false;
}

export function resolveInterventionAlertType(
  categoryLabel: string | null | undefined,
): "servis" | "kvar" {
  return isRegularServiceCategoryLabel(categoryLabel) ? "servis" : "kvar";
}
