"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function MobileSignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/prijava" })}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-muted transition hover:border-cyan-500/35 hover:bg-cyan-100 hover:text-cyan-800 dark:hover:bg-cyan-500/12 dark:hover:text-cyan-200"
    >
      <LogOut size={13} />
      Odjava
    </button>
  );
}