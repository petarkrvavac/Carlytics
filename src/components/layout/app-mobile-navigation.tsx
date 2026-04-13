"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, LogOut, Menu, TriangleAlert, UserRound, X } from "lucide-react";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import type { SessionAppUser } from "@/lib/auth/session";
import { APP_NAVIGATION_ITEMS } from "@/lib/navigation/app-navigation";
import { cn } from "@/lib/utils/cn";

interface AppMobileNavigationProps {
  activeFaultCount: number;
  hasCriticalAlerts: boolean;
  currentUser: SessionAppUser;
}

function isRouteActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppMobileNavigation({
  activeFaultCount,
  hasCriticalAlerts,
  currentUser,
}: AppMobileNavigationProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const showAdminQuickActions = currentUser.role === "admin";

  const primaryItems = useMemo(
    () => APP_NAVIGATION_ITEMS.filter((item) => item.section === "glavno"),
    [],
  );
  const operationsItems = useMemo(
    () => APP_NAVIGATION_ITEMS.filter((item) => item.section === "operativa"),
    [],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground transition hover:border-cyan-500/45 hover:text-cyan-200"
        aria-expanded={isOpen}
        aria-controls="app-mobile-navigation-panel"
        aria-label={isOpen ? "Zatvori navigaciju" : "Otvori navigaciju"}
      >
        <Menu size={18} />
      </button>

      {isOpen && typeof window !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-50 lg:hidden">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm"
                aria-label="Zatvori navigaciju"
              />

              <aside
                id="app-mobile-navigation-panel"
                className="relative z-10 flex h-full w-72 max-w-full flex-col border-r border-border bg-surface px-4 py-5 shadow-[0_16px_40px_rgba(2,6,23,0.5)] sm:w-80 md:w-96"
              >
                <div className="mb-6 rounded-2xl border border-border bg-surface-elevated p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/12 p-1.5">
                        <Image
                          src="/carlytics-logo.png"
                          alt="Carlytics"
                          width={32}
                          height={32}
                          className="h-full w-full rounded-md object-contain"
                        />
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-foreground">Carlytics</p>
                        <p className="text-xs text-muted">Fleet OS</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted transition hover:text-foreground"
                      aria-label="Zatvori meni"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <p className="mt-3 text-xs text-muted">
                    {currentUser.fullName} • {currentUser.roleLabel}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                    <span
                      className={cn(
                        "inline-flex h-2.5 w-2.5 rounded-full",
                        hasCriticalAlerts ? "bg-red-500" : "bg-emerald-500",
                      )}
                    />
                    {hasCriticalAlerts ? "Kritična upozorenja aktivna" : "Flota stabilna"}
                  </div>
                </div>

                <nav className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
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
                              onClick={() => setIsOpen(false)}
                              className={cn(
                                "group flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition",
                                isActive
                                  ? "border-sky-700/70 bg-sky-700 text-white dark:border-cyan-500/50 dark:bg-cyan-500/15 dark:text-cyan-100"
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
                              onClick={() => setIsOpen(false)}
                              className={cn(
                                "group flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition",
                                isActive
                                  ? "border-sky-700/70 bg-sky-700 text-white dark:border-cyan-500/50 dark:bg-cyan-500/15 dark:text-cyan-100"
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
                                  <TriangleAlert size={11} className="mr-1" />
                                  {activeFaultCount}
                                </span>
                              ) : (
                                <ChevronRight
                                  size={14}
                                  className={cn(
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

                <div className="mt-4 space-y-2 border-t border-border pt-4">
                  {showAdminQuickActions ? (
                    <>
                      <Link
                        href="/profil"
                        onClick={() => setIsOpen(false)}
                        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-200"
                      >
                        <UserRound size={14} />
                        Profil
                      </Link>

                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          void signOut({ callbackUrl: "/prijava" });
                        }}
                        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-200"
                      >
                        <LogOut size={14} />
                        Odjava
                      </button>
                    </>
                  ) : null}

                  <Link
                    href="/m"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/12 px-3 text-sm font-medium text-cyan-200 transition hover:border-cyan-500/50 hover:bg-cyan-500/20"
                  >
                    Mobilno sučelje
                  </Link>
                </div>
              </aside>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
