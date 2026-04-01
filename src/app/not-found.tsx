import Link from "next/link";
import { Compass, Home } from "lucide-react";

import { Card } from "@/components/ui/card";

export default function NotFoundPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(6,182,212,0.16),transparent_40%),radial-gradient(circle_at_80%_12%,rgba(56,189,248,0.14),transparent_35%),radial-gradient(circle_at_50%_100%,rgba(2,132,199,0.12),transparent_45%)]" />

      <Card className="relative w-full max-w-2xl border-cyan-500/20 bg-surface/90 p-0 backdrop-blur">
        <div className="border-b border-border px-6 py-5 sm:px-8">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Greška 404</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Tražena stranica ne postoji
          </h1>
          <p className="mt-2 text-sm text-muted">
            Provjeri URL ili se vrati na glavne sekcije aplikacije.
          </p>
        </div>

        <div className="grid gap-4 px-6 py-6 sm:grid-cols-2 sm:px-8 sm:py-7">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Predloženo</p>
            <p className="mt-2 text-sm text-foreground">Nastavi rad na dashboardu i pregledaj upozorenja.</p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Alternativa</p>
            <p className="mt-2 text-sm text-foreground">Ako je sesija istekla, otvori prijavu i nastavi dalje.</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-cyan-300 bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            <Home size={15} />
            Povratak na dashboard
          </Link>
          <Link
            href="/prijava"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200"
          >
            <Compass size={15} />
            Otvori prijavu
          </Link>
        </div>
      </Card>
    </main>
  );
}