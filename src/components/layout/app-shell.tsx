import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { SessionAppUser } from "@/lib/auth/session";

interface AppShellProps {
  children: ReactNode;
  activeFaultCount: number;
  hasCriticalAlerts: boolean;
  currentUser: SessionAppUser;
}

export function AppShell({
  children,
  activeFaultCount,
  hasCriticalAlerts,
  currentUser,
}: AppShellProps) {
  return (
    <div className="ambient-bg min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-450">
        <aside className="sticky top-0 hidden h-screen lg:block">
          <AppSidebar
            activeFaultCount={activeFaultCount}
            hasCriticalAlerts={hasCriticalAlerts}
            currentUser={currentUser}
          />
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-lg sm:px-6 lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                <Image
                  src="/carlytics-logo.png"
                  alt="Carlytics"
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-md"
                />
                Carlytics Fleet OS
              </Link>
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="hidden rounded-lg border border-border bg-surface px-2.5 py-1.5 sm:inline-flex">
                  {currentUser.fullName} • {currentUser.roleLabel}
                </span>
                <ThemeToggle compact />
                <Link
                  href="/m"
                  className="rounded-lg border border-cyan-500/30 bg-cyan-500/12 px-2.5 py-1.5 text-cyan-200"
                >
                  Mobilno
                </Link>
              </div>
            </div>
          </header>

          <main className="surface-grid section-transition flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
