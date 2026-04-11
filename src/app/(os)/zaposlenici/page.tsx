import { EmployeesSectionContent } from "@/components/employees/employees-section-content";
import { getOptionalSessionUser } from "@/lib/auth/session";
import { getEmployeesOverviewData } from "@/lib/employees/employee-service";

export default async function ZaposleniciPage() {
  const [overviewData, sessionUser] = await Promise.all([
    getEmployeesOverviewData(),
    getOptionalSessionUser(),
  ]);
  const canManageEmployees = sessionUser?.role === "admin";

  return (
    <EmployeesSectionContent
      overviewData={overviewData}
      canManageEmployees={canManageEmployees}
    />
  );
}
