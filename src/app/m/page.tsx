import Link from "next/link";
import { Fuel, TriangleAlert, UserRound } from "lucide-react";

import { WorkerAssignmentControls } from "@/components/mobile/worker-assignment-controls";
import { Card } from "@/components/ui/card";
import { requireSessionUser } from "@/lib/auth/session";
import {
  getActiveWorkerVehicleContext,
  getAvailableWorkerVehicles,
} from "@/lib/fleet/worker-context-service";

export default async function MobileHomePage() {
  const sessionUser = await requireSessionUser({
    allowedRoles: ["zaposlenik", "admin"],
    redirectTo: "/prijava",
    forbiddenRedirectTo: "/dashboard",
  });

  const [activeContext, availableVehicles] = await Promise.all([
    getActiveWorkerVehicleContext(sessionUser.employeeId),
    getAvailableWorkerVehicles(sessionUser.employeeId),
  ]);

  return (
    <div className="space-y-4">
      <Card>
        <h1 className="text-xl font-semibold text-foreground">Operativa na terenu</h1>
        <WorkerAssignmentControls
          key={activeContext?.assignmentId ?? "no-assignment"}
          activeContext={activeContext}
          availableVehicles={availableVehicles}
        />
      </Card>

      <div className="grid gap-3">
        <Link
          href="/m/prijava-kvara"
          className="rounded-2xl border border-rose-300 bg-rose-50 p-4 transition hover:border-rose-400/70 hover:bg-rose-100 dark:border-rose-500/35 dark:bg-rose-500/10 dark:hover:bg-rose-500/20"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-rose-300 bg-rose-100 p-2 dark:border-rose-500/35 dark:bg-rose-500/15">
              <TriangleAlert className="text-rose-700 dark:text-rose-300" size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">Prijava kvara</p>
              <p className="text-xs text-rose-700/90 dark:text-rose-100/80">Opis, kategorija, fotografija</p>
            </div>
          </div>
        </Link>

        <Link
          href="/m/gorivo"
          className="rounded-2xl border border-cyan-300 bg-cyan-50 p-4 transition hover:border-cyan-400/70 hover:bg-cyan-100 dark:border-cyan-500/35 dark:bg-cyan-500/10 dark:hover:bg-cyan-500/20"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-cyan-300 bg-cyan-100 p-2 dark:border-cyan-500/35 dark:bg-cyan-500/15">
              <Fuel className="text-cyan-700 dark:text-cyan-300" size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-cyan-800 dark:text-cyan-200">Unos goriva</p>
              <p className="text-xs text-cyan-700/90 dark:text-cyan-100/80">KM, litraža, cijena po litri</p>
            </div>
          </div>
        </Link>

        <Link
          href="/m/profil"
          className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 transition hover:border-emerald-400/70 hover:bg-emerald-100 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-emerald-300 bg-emerald-100 p-2 dark:border-emerald-500/35 dark:bg-emerald-500/15">
              <UserRound className="text-emerald-700 dark:text-emerald-300" size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Profil</p>
              <p className="text-xs text-emerald-700/90 dark:text-emerald-100/80">Podaci o korisničkom računu</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
