import { Card } from "@/components/ui/card";
import { FaultReportForm } from "@/components/mobile/fault-report-form";
import { requireSessionUser } from "@/lib/auth/session";
import {
  getActiveWorkerVehicleContext,
  getFaultCategoryOptions,
} from "@/lib/fleet/worker-context-service";

export default async function MobilePrijavaKvaraPage() {
  const sessionUser = await requireSessionUser({
    allowedRoles: ["radnik", "admin"],
    redirectTo: "/prijava",
    forbiddenRedirectTo: "/dashboard",
  });

  const [activeContext, categories] = await Promise.all([
    getActiveWorkerVehicleContext(sessionUser.employeeId),
    getFaultCategoryOptions(),
  ]);

  return (
    <div className="space-y-4">
      <Card>
        <h1 className="text-lg font-semibold text-foreground">Prijava kvara</h1>
        {activeContext ? (
          <p className="mt-2 text-sm text-muted">
            Aktivno vozilo: <span className="font-semibold text-foreground">{activeContext.vehicleLabel}</span>
            <span className="text-muted"> ({activeContext.plate})</span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
            Nemate aktivno zaduženje vozila. Prijava kvara je zaključana.
          </p>
        )}
      </Card>

      <FaultReportForm categories={categories} activeContext={activeContext} />
    </div>
  );
}
