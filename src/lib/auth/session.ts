import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { redirect } from "next/navigation";

import {
  getRoleLabel,
  hasRequiredRole,
  type AppRole,
} from "@/lib/auth/roles";
import { authOptions } from "@/lib/auth/auth-options";

export interface SessionAppUser {
  id: string;
  employeeId: number;
  username: string;
  fullName: string;
  role: AppRole;
  roleLabel: string;
}

interface RequireSessionOptions {
  allowedRoles?: AppRole[];
  redirectTo?: string;
  forbiddenRedirectTo?: string;
}

function parseSessionUser(session: Session | null) {
  const sessionUser = session?.user;

  if (!sessionUser || !sessionUser.role || !sessionUser.employeeId) {
    return null;
  }

  return {
    id: sessionUser.id,
    employeeId: sessionUser.employeeId,
    username: sessionUser.username,
    fullName: sessionUser.name ?? sessionUser.username,
    role: sessionUser.role,
    roleLabel: getRoleLabel(sessionUser.role),
  } satisfies SessionAppUser;
}

export async function getOptionalSessionUser() {
  const session = await getServerSession(authOptions);
  return parseSessionUser(session);
}

export async function requireSessionUser(options: RequireSessionOptions = {}) {
  const sessionUser = await getOptionalSessionUser();

  if (!sessionUser) {
    redirect(options.redirectTo ?? "/prijava");
  }

  if (
    options.allowedRoles &&
    !hasRequiredRole(sessionUser.role, options.allowedRoles)
  ) {
    redirect(
      options.forbiddenRedirectTo ??
        (sessionUser.role === "radnik" ? "/m" : "/dashboard"),
    );
  }

  return sessionUser;
}
