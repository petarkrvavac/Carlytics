import { NextResponse } from "next/server";

import { hasRequiredRole } from "@/lib/auth/roles";
import { getOptionalSessionUser } from "@/lib/auth/session";
import { getEmployeeFormContext } from "@/lib/employees/employee-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessionUser = await getOptionalSessionUser();

  if (!sessionUser) {
    return NextResponse.json(
      {
        message: "Prijava je istekla. Prijavi se ponovno.",
      },
      {
        status: 401,
      },
    );
  }

  if (!hasRequiredRole(sessionUser.role, ["admin"])) {
    return NextResponse.json(
      {
        message: "Nemaš dozvolu za dohvat podataka forme zaposlenika.",
      },
      {
        status: 403,
      },
    );
  }

  const formContext = await getEmployeeFormContext();

  return NextResponse.json(formContext, {
    status: 200,
  });
}
