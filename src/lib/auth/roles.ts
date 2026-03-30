export const APP_ROLES = ["admin", "serviser", "radnik"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrator",
  serviser: "Voditelj",
  radnik: "Zaposlenik",
};

export function mapRoleNameToAppRole(roleName: string | null | undefined): AppRole {
  if (!roleName) {
    return "radnik";
  }

  const normalized = roleName.trim().toLowerCase();

  if (normalized.includes("admin")) {
    return "admin";
  }

  if (
    normalized.includes("serv") ||
    normalized.includes("voditelj") ||
    normalized.includes("manager")
  ) {
    return "serviser";
  }

  if (
    normalized.includes("zaposlenik") ||
    normalized.includes("radnik") ||
    normalized.includes("vozac")
  ) {
    return "radnik";
  }

  return "radnik";
}

export function getRoleLabel(role: AppRole) {
  return APP_ROLE_LABELS[role];
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
