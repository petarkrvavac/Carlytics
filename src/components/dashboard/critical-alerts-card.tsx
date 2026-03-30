import { AlertTriangle, BellRing, CalendarClock, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import type { AlertSeverity, CriticalAlert } from "@/lib/fleet/types";
import { cn } from "@/lib/utils/cn";

interface CriticalAlertsCardProps {
  alerts: CriticalAlert[];
}

function getSeverityBadgeVariant(severity: AlertSeverity) {
  if (severity === "kriticno") {
    return "danger" as const;
  }

  if (severity === "upozorenje") {
    return "warning" as const;
  }

  return "info" as const;
}

function getSeverityLabel(severity: AlertSeverity) {
  if (severity === "kriticno") {
    return "Kritično";
  }

  if (severity === "upozorenje") {
    return "Upozorenje";
  }

  return "Info";
}

function getAlertIcon(type: CriticalAlert["type"]) {
  if (type === "registracija") {
    return CalendarClock;
  }

  if (type === "servis") {
    return Wrench;
  }

  return AlertTriangle;
}

export function CriticalAlertsCard({ alerts }: CriticalAlertsCardProps) {
  return (
    <Card>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <CardTitle>Kritična upozorenja</CardTitle>
          <CardDescription className="mt-1">
            Registracije, servisi i prijave kvarova koje traže akciju.
          </CardDescription>
        </div>
        <Badge variant={alerts.length > 0 ? "warning" : "success"}>
          <BellRing size={12} className="mr-1" />
          {alerts.length}
        </Badge>
      </div>

      {alerts.length === 0 ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-200">
          Trenutačno nema otvorenih kritičnih upozorenja.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {alerts.map((alert) => {
            const Icon = getAlertIcon(alert.type);

            return (
              <li
                key={alert.id}
                className={cn(
                  "rounded-xl border px-3 py-3",
                  alert.severity === "kriticno"
                    ? "border-rose-500/25 bg-rose-500/10"
                    : alert.severity === "upozorenje"
                      ? "border-amber-500/25 bg-amber-500/10"
                      : "border-sky-500/25 bg-sky-500/10",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex gap-2">
                    <Icon
                      size={15}
                      className={cn(
                        "mt-0.5 shrink-0",
                        alert.severity === "kriticno"
                          ? "text-rose-300"
                          : alert.severity === "upozorenje"
                            ? "text-amber-300"
                            : "text-sky-300",
                      )}
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-100">{alert.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-300">
                        {alert.description}
                      </p>
                    </div>
                  </div>

                  <Badge variant={getSeverityBadgeVariant(alert.severity)}>
                    {getSeverityLabel(alert.severity)}
                  </Badge>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
