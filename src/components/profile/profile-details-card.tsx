import { UserRound } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { EmployeeProfileDetails } from "@/lib/employees/employee-service";

interface ProfileDetailsCardProps {
  profile: EmployeeProfileDetails;
}

function getDisplayValue(value: string | null) {
  const normalized = value?.trim();

  if (!normalized) {
    return "Nije dostupno";
  }

  return normalized;
}

export function ProfileDetailsCard({ profile }: ProfileDetailsCardProps) {
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-cyan-300 bg-cyan-50 dark:border-cyan-500/35 dark:bg-cyan-500/12">
          <UserRound className="text-cyan-700 dark:text-cyan-200" size={38} />
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Korisnički profil</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            {profile.firstName} {profile.lastName}
          </h2>
          <p className="mt-1 text-sm text-muted">@{profile.username}</p>
        </div>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
          <dt className="text-xs uppercase tracking-[0.18em] text-muted">Ime</dt>
          <dd className="mt-1 text-sm font-medium text-foreground">{getDisplayValue(profile.firstName)}</dd>
        </div>

        <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
          <dt className="text-xs uppercase tracking-[0.18em] text-muted">Prezime</dt>
          <dd className="mt-1 text-sm font-medium text-foreground">{getDisplayValue(profile.lastName)}</dd>
        </div>

        <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
          <dt className="text-xs uppercase tracking-[0.18em] text-muted">Korisničko ime</dt>
          <dd className="mt-1 text-sm font-medium text-foreground">{getDisplayValue(profile.username)}</dd>
        </div>

        <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
          <dt className="text-xs uppercase tracking-[0.18em] text-muted">Uloga</dt>
          <dd className="mt-1 text-sm font-medium text-foreground">{getDisplayValue(profile.role)}</dd>
        </div>

        <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
          <dt className="text-xs uppercase tracking-[0.18em] text-muted">Email</dt>
          <dd className="mt-1 text-sm font-medium text-foreground">{getDisplayValue(profile.email)}</dd>
        </div>

        <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
          <dt className="text-xs uppercase tracking-[0.18em] text-muted">Mjesto</dt>
          <dd className="mt-1 text-sm font-medium text-foreground">{getDisplayValue(profile.city)}</dd>
        </div>

        <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
          <dt className="text-xs uppercase tracking-[0.18em] text-muted">Županija</dt>
          <dd className="mt-1 text-sm font-medium text-foreground">{getDisplayValue(profile.county)}</dd>
        </div>

        <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
          <dt className="text-xs uppercase tracking-[0.18em] text-muted">Država</dt>
          <dd className="mt-1 text-sm font-medium text-foreground">{getDisplayValue(profile.country)}</dd>
        </div>
      </dl>
    </Card>
  );
}
