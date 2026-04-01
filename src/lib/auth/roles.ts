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
  zaposlenik: "zaposlenik",
  admin: "admin",
  voditelj_flote: "voditelj_flote",
};

export function mapRoleNameToAppRole(roleName: string | null | undefined): AppRole {
  if (!roleName) {
    return "zaposlenik";
  }

  const normalized = roleName.trim().toLowerCase();
  return ROLE_NAME_TO_APP_ROLE[normalized] ?? "zaposlenik";
}

export function getRoleLabel(role: AppRole) {
  return APP_ROLE_LABELS[role];
}

export function getRoleLabelFromName(roleName: string | null | undefined) {
  return getRoleLabel(mapRoleNameToAppRole(roleName));
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
