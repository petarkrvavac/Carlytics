import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { LiveUpdatesProvider } from "@/components/layout/live-updates-provider";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { MobileSignOutButton } from "@/components/mobile/mobile-sign-out-button";
import { requireSessionUser } from "@/lib/auth/session";

interface MobileLayoutProps {
  children: ReactNode;
}

export const dynamic = "force-dynamic";

export default async function MobileLayout({ children }: MobileLayoutProps) {
  const currentUser = await requireSessionUser({
    allowedRoles: ["zaposlenik", "admin", "voditelj_flote"],
    redirectTo: "/prijava",
    forbiddenRedirectTo: "/dashboard",
  });

  return (
    <LiveUpdatesProvider>
      <div className="ambient-bg min-h-screen h-dvh overflow-hidden">
        <div className="mx-auto flex h-full max-w-md flex-col px-4 py-4">
          <header className="mb-4 rounded-2xl border border-border bg-surface/90 p-4">
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/m"
                className="inline-flex items-center gap-2 text-sm font-semibold text-foreground transition hover:text-cyan-200"
              >
                <Image
                  src="/carlytics-logo.png"
                  alt="Carlytics"
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-md object-contain"
                />
                Carlytics
              </Link>

              <div className="flex items-center gap-2">
                <ThemeToggle compact />
                <MobileSignOutButton />
                {currentUser.role !== "zaposlenik" ? (
                  <Link
                    href="/dashboard"
                    className="inline-flex h-8 items-center rounded-lg border border-cyan-500/35 bg-cyan-100 px-2.5 text-xs font-medium text-cyan-800 transition hover:border-cyan-500/55 hover:bg-cyan-200 dark:bg-cyan-500/12 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
                  >
                    Desktop
                  </Link>
                ) : null}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">Brze akcije za operativni unos na terenu.</p>
            <p className="mt-1 text-xs text-muted">
              {currentUser.fullName} • {currentUser.roleLabel}
            </p>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </LiveUpdatesProvider>
  );
}
