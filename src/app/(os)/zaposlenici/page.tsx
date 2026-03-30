import { EmployeesSectionContent } from "@/components/employees/employees-section-content";
import {
  getEmployeeFormContext,
  getEmployeesOverviewData,
} from "@/lib/employees/employee-service";

export default async function ZaposleniciPage() {
  const [overviewData, formContext] = await Promise.all([
    getEmployeesOverviewData(),
    getEmployeeFormContext(),
  ]);

  return (
    <EmployeesSectionContent
      overviewData={overviewData}
      formContext={formContext}
    />
  );
}
