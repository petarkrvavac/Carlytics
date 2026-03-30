import Link from "next/link";
import { Activity, Fuel, TriangleAlert, UserCheck, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

export type ActivityFeedType = "kvar" | "servis" | "gorivo" | "zaduzenje";

export interface DashboardActivityItem {
  id: string;
  occurredAtIso: string;
  type: ActivityFeedType;
  title: string;
  description: string;
  href: string;
  severity?: "kriticno" | "upozorenje" | "info";
}

interface OperationsActivityFeedProps {
  items: DashboardActivityItem[];
}

function formatDateTime(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function getTypeIcon(type: ActivityFeedType) {
  if (type === "kvar") {
    return TriangleAlert;
  }

  if (type === "servis") {
    return Wrench;
  }

  if (type === "gorivo") {
    return Fuel;
  }

  return UserCheck;
}

function getTypeLabel(type: ActivityFeedType) {
  if (type === "kvar") {
    return "Kvar";
  }

  if (type === "servis") {
    return "Servis";
  }

  if (type === "gorivo") {
    return "Gorivo";
  }

  return "Zaduženje";
}

function getTypeBadgeVariant(type: ActivityFeedType) {
  if (type === "kvar") {
    return "danger" as const;
  }

  if (type === "servis") {
    return "warning" as const;
  }

  if (type === "gorivo") {
    return "info" as const;
  }

  return "neutral" as const;
}

function getItemTone(item: DashboardActivityItem) {
  if (item.severity === "kriticno") {
    return "border-red-500/35 bg-red-500/10";
  }

  if (item.severity === "upozorenje") {
    return "border-amber-500/30 bg-amber-500/10";
  }

  return "border-border bg-slate-950/55";
}

export function OperationsActivityFeed({ items }: OperationsActivityFeedProps) {
  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <CardTitle>Activity Feed</CardTitle>
          <CardDescription className="mt-1">
            Zadnje operativne promjene kroz kvarove, servise, gorivo i zaduženja.
          </CardDescription>
        </div>
        <Badge variant="info">
          <Activity size={12} className="mr-1" />
          {items.length}
        </Badge>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-slate-950/50 px-4 py-4 text-sm text-muted">
          Trenutačno nema zabilježenih aktivnosti.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => {
            const Icon = getTypeIcon(item.type);

            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={cn(
                    "block rounded-xl border px-3 py-3 transition hover:border-cyan-500/45 hover:bg-slate-900/70",
                    getItemTone(item),
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex gap-2">
                      <Icon size={15} className="mt-0.5 text-cyan-200" />
                      <div>
                        <p className="text-sm font-medium text-slate-100">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-300">{item.description}</p>
                      </div>
                    </div>

                    <Badge variant={getTypeBadgeVariant(item.type)}>{getTypeLabel(item.type)}</Badge>
                  </div>

                  <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                    {formatDateTime(item.occurredAtIso)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
