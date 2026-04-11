export const APP_ROLES = ["admin", "voditelj_flote", "zaposlenik"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrator",
  voditelj_flote: "Voditelj flote",
  zaposlenik: "Zaposlenik",
};

const ROLE_NAME_TO_APP_ROLE: Record<string, AppRole> = {
  administrator: "admin",
  "voditelj flote": "voditelj_flote",
  voditelj: "voditelj_flote",
  serviser: "voditelj_flote",
  "voditelj servisa": "voditelj_flote",
  "fleet manager": "voditelj_flote",
  "fleet lead": "voditelj_flote",
  flota: "voditelj_flote",
  fleet: "voditelj_flote",
  zaposlenik: "zaposlenik",
  radnik: "zaposlenik",
  admin: "admin",
  voditelj_flote: "voditelj_flote",
};

const ROLE_ID_TO_APP_ROLE: Partial<Record<number, AppRole>> = {
  1: "admin",
  2: "voditelj_flote",
  3: "zaposlenik",
};

function normalizeRoleName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function mapNormalizedRoleNameToAppRole(normalized: string): AppRole {
  const mappedRole = ROLE_NAME_TO_APP_ROLE[normalized];

  if (mappedRole) {
    return mappedRole;
  }

  if (normalized.includes("admin")) {
    return "admin";
  }

  if (
    normalized.includes("voditelj") ||
    normalized.includes("manager") ||
    normalized.includes("servis") ||
    normalized.includes("flot") ||
    normalized.includes("fleet")
  ) {
    return "voditelj_flote";
  }

  return "zaposlenik";
}

export function mapRoleToAppRole(params: {
  roleId?: number | null;
  roleName?: string | null | undefined;
}): AppRole {
  const normalizedRoleName = params.roleName ? normalizeRoleName(params.roleName) : "";
  const mappedByName = normalizedRoleName
    ? mapNormalizedRoleNameToAppRole(normalizedRoleName)
    : null;

  if (mappedByName && mappedByName !== "zaposlenik") {
    return mappedByName;
  }

  if (typeof params.roleId === "number") {
    const mappedById = ROLE_ID_TO_APP_ROLE[params.roleId];

    if (mappedById && (!mappedByName || mappedByName === "zaposlenik")) {
      return mappedById;
    }
  }

  return mappedByName ?? "zaposlenik";
}

export function mapRoleNameToAppRole(roleName: string | null | undefined): AppRole {
  return mapRoleToAppRole({ roleName });
}

export function getRoleLabel(role: AppRole) {
  return APP_ROLE_LABELS[role];
}

export function getRoleLabelFromName(
  roleName: string | null | undefined,
  roleId?: number | null,
) {
  return getRoleLabel(mapRoleToAppRole({ roleName, roleId }));
}

export function hasRequiredRole(
  role: AppRole | null | undefined,
  allowed: AppRole[],
) {
  if (!role) {
    return false;
  }

  return allowed.includes(role);
}
