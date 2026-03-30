import { EmployeesSectionContent } from "@/components/employees/employees-section-content";
import { getEmployeesOverviewData } from "@/lib/employees/employee-service";

export default async function ZaposleniciPage() {
  const overviewData = await getEmployeesOverviewData();

  return (
    <EmployeesSectionContent overviewData={overviewData} />
  );
}
