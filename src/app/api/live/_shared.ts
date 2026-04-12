import { NextResponse } from "next/server";

import { hasRequiredRole, type AppRole } from "@/lib/auth/roles";
import { getOptionalSessionUser } from "@/lib/auth/session";

export const LIVE_NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

interface RequireLiveApiUserResult {
  errorResponse: NextResponse | null;
  user: Awaited<ReturnType<typeof getOptionalSessionUser>>;
}

export async function requireLiveApiUser(
  allowedRoles: AppRole[],
): Promise<RequireLiveApiUserResult> {
  const user = await getOptionalSessionUser();

  if (!user) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { message: "Prijava je obavezna za live sinkronizaciju." },
        { status: 401, headers: LIVE_NO_STORE_HEADERS },
      ),
    };
  }

  if (!hasRequiredRole(user.role, allowedRoles)) {
    return {
      user,
      errorResponse: NextResponse.json(
        { message: "Nemate ovlasti za ovu live sinkronizaciju." },
        { status: 403, headers: LIVE_NO_STORE_HEADERS },
      ),
    };
  }

  return {
    user,
    errorResponse: null,
  };
}

export function parsePositiveNumberParam(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}
