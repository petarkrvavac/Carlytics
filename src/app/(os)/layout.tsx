import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { LiveUpdatesProvider } from "@/components/layout/live-updates-provider";
import { requireSessionUser } from "@/lib/auth/session";
import { getAppShellMetrics } from "@/lib/fleet/dashboard-service";

interface OsLayoutProps {
  children: ReactNode;
}

export const dynamic = "force-dynamic";

export default async function OsLayout({ children }: OsLayoutProps) {
  const currentUser = await requireSessionUser({
    allowedRoles: ["admin", "voditelj_flote"],
    redirectTo: "/prijava",
    forbiddenRedirectTo: "/m",
  });

  const metrics = await getAppShellMetrics();

  return (
    <LiveUpdatesProvider>
      <AppShell
        activeFaultCount={metrics.activeFaultCount}
        hasCriticalAlerts={metrics.hasCriticalAlerts}
        currentUser={currentUser}
      >
        {children}
      </AppShell>
    </LiveUpdatesProvider>
  );
}
