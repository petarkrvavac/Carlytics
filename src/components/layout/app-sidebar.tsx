"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronRight, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

import { APP_NAVIGATION_ITEMS } from "@/lib/navigation/app-navigation";
import type { SessionAppUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils/cn";
import { ThemeToggle } from "@/components/layout/theme-toggle";

interface AppSidebarProps {
  activeFaultCount: number;
  hasCriticalAlerts: boolean;
  currentUser: SessionAppUser;
}

function isRouteActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({
  activeFaultCount,
  hasCriticalAlerts,
  currentUser,
}: AppSidebarProps) {
  const pathname = usePathname();

  const primaryItems = APP_NAVIGATION_ITEMS.filter(
    (item) => item.section === "glavno",
  );
  const operationsItems = APP_NAVIGATION_ITEMS.filter(
    (item) => item.section === "operativa",
  );

  return (
    <div className="flex h-screen w-65 flex-col border-r border-border bg-surface/95 px-4 py-5 backdrop-blur-sm">
      <div className="mb-8 rounded-2xl border border-border bg-surface-elevated p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/12 p-1.5">
              <Image
                src="/carlytics-logo.png"
                alt="Carlytics"
                width={36}
                height={36}
                className="h-full w-full rounded-md object-contain"
              />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide text-foreground">Carlytics</p>
              <p className="text-xs text-muted">Fleet OS</p>
            </div>
          </div>

          <div
            className={cn(
              "relative inline-flex h-2.5 w-2.5 rounded-full",
              hasCriticalAlerts ? "bg-red-500" : "bg-emerald-500",
            )}
            aria-label={hasCriticalAlerts ? "Kritični kvarovi aktivni" : "Flota stabilna"}
          >
            <span
              className={cn(
                "absolute inset-0 rounded-full animate-ping",
                hasCriticalAlerts ? "bg-red-500/70" : "bg-emerald-500/70",
              )}
            />
          </div>
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div>
          <p className="mb-3 px-2 text-[11px] uppercase tracking-[0.24em] text-muted">Glavno</p>
          <ul className="space-y-1.5">
            {primaryItems.map((item) => {
              const isActive = isRouteActive(pathname, item.href);
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "group flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition",
                      isActive
                        ? "border-sky-700/70 bg-sky-700 text-white shadow-[0_8px_20px_rgba(3,105,161,0.24)] dark:border-cyan-500/50 dark:bg-cyan-500/15 dark:text-cyan-100 dark:shadow-none"
                        : "border-transparent text-slate-800 dark:text-muted hover:border-sky-200 hover:bg-sky-100 hover:text-sky-900 dark:hover:border-border dark:hover:bg-surface dark:hover:text-foreground",
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon
                        size={16}
                        className={isActive ? "text-white dark:text-cyan-300" : "text-muted"}
                      />
                      {item.label}
                    </span>
                    <ChevronRight
                      size={14}
                      className={cn(
                        "transition",
                        isActive
                          ? "text-white dark:text-cyan-300"
                          : "text-muted group-hover:text-foreground",
                      )}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <p className="mb-3 px-2 text-[11px] uppercase tracking-[0.24em] text-muted">Operativa</p>
          <ul className="space-y-1.5">
            {operationsItems.map((item) => {
              const isActive = isRouteActive(pathname, item.href);
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "group flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition",
                      isActive
                        ? "border-sky-700/70 bg-sky-700 text-white shadow-[0_8px_20px_rgba(3,105,161,0.24)] dark:border-cyan-500/50 dark:bg-cyan-500/15 dark:text-cyan-100 dark:shadow-none"
                        : "border-transparent text-slate-800 dark:text-muted hover:border-sky-200 hover:bg-sky-100 hover:text-sky-900 dark:hover:border-border dark:hover:bg-surface dark:hover:text-foreground",
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon
                        size={16}
                        className={isActive ? "text-white dark:text-cyan-300" : "text-muted"}
                      />
                      {item.label}
                    </span>
                    {item.href === "/prijava-kvara" && activeFaultCount > 0 ? (
                      <span className="inline-flex min-w-7 items-center justify-center rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-200">
                        {activeFaultCount}
                      </span>
                    ) : (
                      <ChevronRight
                        size={14}
                        className={cn(
                          "transition",
                          isActive
                            ? "text-white dark:text-cyan-300"
                            : "text-muted group-hover:text-foreground",
                        )}
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <div className="border-t border-border pt-4">
        <details className="group rounded-xl border border-border bg-surface-elevated p-3">
          <summary className="flex list-none cursor-pointer items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
            <div>
              <p className="text-sm font-medium text-foreground">{currentUser.fullName}</p>
              <p className="mt-1 text-xs text-muted">Uloga: {currentUser.roleLabel}</p>
              <p className="mt-1 text-xs text-muted">@{currentUser.username}</p>
            </div>
            <ChevronDown
              size={15}
              className="text-muted transition group-open:rotate-180"
            />
          </summary>

          <div className="mt-3 space-y-1.5 border-t border-border pt-3">
            <Link
              href="/profil"
              className="block rounded-lg px-2.5 py-2 text-xs text-slate-700 transition hover:bg-sky-100 hover:text-sky-900 dark:text-muted dark:hover:bg-surface dark:hover:text-cyan-200"
            >
              Profil
            </Link>

            <div className="pt-1">
              <ThemeToggle className="w-full justify-center" />
            </div>

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/prijava" })}
              className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface text-xs font-medium text-muted transition hover:border-border hover:text-foreground"
            >
              <LogOut size={13} />
              Odjava
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}
