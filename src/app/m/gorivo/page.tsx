import { Card } from "@/components/ui/card";
import { FuelEntryForm } from "@/components/mobile/fuel-entry-form";
import { requireSessionUser } from "@/lib/auth/session";
import { getActiveWorkerVehicleContext } from "@/lib/fleet/worker-context-service";

export default async function MobileGorivoPage() {
  const sessionUser = await requireSessionUser({
    allowedRoles: ["zaposlenik", "admin"],
    redirectTo: "/prijava",
    forbiddenRedirectTo: "/dashboard",
  });

  const activeContext = await getActiveWorkerVehicleContext(sessionUser.employeeId);

  return (
    <div className="space-y-4">
      <Card>
        <h1 className="text-lg font-semibold text-foreground">Unos goriva</h1>
        {activeContext ? (
          <p className="mt-2 text-sm text-muted">
            Aktivno vozilo: <span className="font-semibold text-foreground">{activeContext.vehicleLabel}</span>
            <span className="text-muted"> ({activeContext.plate})</span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
            Nemate aktivno zaduženje vozila. Unos goriva je zaključan.
          </p>
        )}
      </Card>

      <FuelEntryForm activeContext={activeContext} />
    </div>
  );
}
