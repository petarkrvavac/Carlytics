import Link from "next/link";
import { Activity, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import type { FleetHealthSummary } from "@/lib/fleet/types";

interface FleetHealthCardProps {
  summary: FleetHealthSummary;
}

export function FleetHealthCard({ summary }: FleetHealthCardProps) {
  return (
    <Card className="relative h-full overflow-hidden p-4 pb-3">
      <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-cyan-500/15 blur-3xl" />

      <div className="relative flex h-full flex-col">
        <div className="mb-3.5 flex items-start justify-between gap-3">
          <div>
            <CardTitle>Stanje voznog parka</CardTitle>
            <CardDescription className="mt-1">
              Operativna dostupnost vozila u stvarnom vremenu.
            </CardDescription>
          </div>
          <Badge variant={summary.inService > 0 ? "warning" : "success"}>
            {summary.operational}/{summary.total} operativno
          </Badge>
        </div>

        <div className="mb-3 flex justify-center">
          <Link
            href="/flota"
            className="grid h-24 w-24 place-items-center rounded-full"
            style={{
              background: `conic-gradient(#06b6d4 ${summary.percentage * 3.6}deg, #cbd5e1 0deg)`,
            }}
          >
            <div className="grid h-18 w-18 place-items-center rounded-full border border-border bg-surface text-center">
              <p className="text-xl font-semibold text-foreground">{summary.percentage}%</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">Detalji</p>
            </div>
          </Link>
        </div>

        <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-2 text-sm">
            <Link
              href="/flota"
              className="flex h-full flex-col justify-center rounded-xl border border-border bg-surface p-2.5 transition hover:border-cyan-500/45"
            >
              <p className="text-muted">Slobodna + zauzeta</p>
              <p className="mt-1 text-base font-semibold leading-none text-foreground">{summary.operational}</p>
            </Link>
            <Link
              href="/flota?status=servis"
              className="flex h-full flex-col justify-center rounded-xl border border-border bg-surface p-2.5 transition hover:border-amber-500/45"
            >
              <p className="text-muted">Na servisu</p>
              <p className="mt-1 text-base font-semibold leading-none text-amber-300">{summary.inService}</p>
            </Link>
            <Link
              href="/flota"
              className="flex h-full flex-col justify-center rounded-xl border border-border bg-surface p-2.5 transition hover:border-slate-600"
            >
              <p className="text-muted">Ukupno vozila</p>
              <p className="mt-1 flex items-center gap-1.5 text-base font-semibold leading-none text-foreground">
                <Activity size={15} className="text-cyan-300" />
                {summary.total}
              </p>
            </Link>
            <Link
              href="/flota?status=zauzeto"
              className="flex h-full flex-col justify-center rounded-xl border border-border bg-surface p-2.5 transition hover:border-sky-500/45"
            >
              <p className="text-muted">Aktivna zauzeća</p>
              <p className="mt-1 flex items-center gap-1.5 text-base font-semibold leading-none text-sky-300">
                <Wrench size={15} className="text-sky-300" />
                {summary.occupied}
              </p>
            </Link>
        </div>
      </div>
    </Card>
  );
}
