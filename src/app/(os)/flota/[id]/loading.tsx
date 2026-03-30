const metricCards = Array.from({ length: 4 });
const listRows = Array.from({ length: 5 });

function DetailCardSkeleton() {
  return (
    <section className="rounded-2xl border border-border bg-surface/95 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="skeleton-shimmer h-4 w-32 animate-pulse rounded-md bg-surface-elevated" />
          <div className="skeleton-shimmer h-6 w-3/5 animate-pulse rounded-md bg-surface-elevated" />
          <div className="skeleton-shimmer h-6 w-24 animate-pulse rounded-md bg-surface-elevated" />
        </div>
        <div className="skeleton-shimmer h-7 w-20 animate-pulse rounded-lg bg-surface-elevated" />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {metricCards.map((_, index) => (
          <div key={`metric-${index}`} className="rounded-xl border border-border bg-surface p-3">
            <div className="skeleton-shimmer h-3.5 w-24 animate-pulse rounded-md bg-surface-elevated" />
            <div className="mt-2 skeleton-shimmer h-6 w-20 animate-pulse rounded-md bg-surface-elevated" />
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <div className="skeleton-shimmer h-7 w-56 animate-pulse rounded-lg bg-surface-elevated" />
        <div className="skeleton-shimmer h-7 w-48 animate-pulse rounded-lg bg-surface-elevated" />
      </div>
    </section>
  );
}

function RiskCardSkeleton() {
  return (
    <section className="rounded-2xl border border-border bg-surface/95 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="skeleton-shimmer h-4 w-28 animate-pulse rounded-md bg-surface-elevated" />
          <div className="skeleton-shimmer h-3.5 w-full animate-pulse rounded-md bg-surface-elevated" />
        </div>
        <div className="skeleton-shimmer h-5 w-5 animate-pulse rounded-md bg-surface-elevated" />
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="skeleton-shimmer h-3.5 w-20 animate-pulse rounded-md bg-surface-elevated" />
          <div className="skeleton-shimmer h-3.5 w-24 animate-pulse rounded-md bg-surface-elevated" />
        </div>
        <div className="skeleton-shimmer h-1.5 w-full animate-pulse rounded-full bg-surface-elevated" />
      </div>

      <div className="mt-5 space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`risk-${index}`}
            className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2"
          >
            <div className="skeleton-shimmer h-3.5 w-24 animate-pulse rounded-md bg-surface-elevated" />
            <div className="skeleton-shimmer h-3.5 w-16 animate-pulse rounded-md bg-surface-elevated" />
          </div>
        ))}
      </div>
    </section>
  );
}

function HistoryCardSkeleton() {
  return (
    <section className="rounded-2xl border border-border bg-surface/95 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="skeleton-shimmer h-4 w-32 animate-pulse rounded-md bg-surface-elevated" />
        <div className="skeleton-shimmer h-7 w-24 animate-pulse rounded-lg bg-surface-elevated" />
      </div>

      <div className="space-y-3">
        {listRows.map((_, index) => (
          <div key={`history-${index}`} className="rounded-xl border border-border bg-surface px-3 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="skeleton-shimmer h-4 w-4/5 animate-pulse rounded-md bg-surface-elevated" />
                <div className="skeleton-shimmer h-3.5 w-full animate-pulse rounded-md bg-surface-elevated" />
              </div>
              <div className="skeleton-shimmer h-7 w-18 animate-pulse rounded-lg bg-surface-elevated" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function FlotaVehicleDetailLoading() {
  return (
    <div className="space-y-5">
      <header className="mb-8 flex flex-col gap-5 border-b border-border/70 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2.5">
          <div className="skeleton-shimmer h-8 w-64 animate-pulse rounded-lg bg-surface-elevated" />
          <div className="skeleton-shimmer h-4 w-full max-w-2xl animate-pulse rounded-md bg-surface-elevated" />
          <div className="skeleton-shimmer h-4 w-4/5 animate-pulse rounded-md bg-surface-elevated" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="skeleton-shimmer h-10 w-44 animate-pulse rounded-xl bg-surface-elevated" />
          <div className="skeleton-shimmer h-10 w-40 animate-pulse rounded-xl bg-surface-elevated" />
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <DetailCardSkeleton />
        <RiskCardSkeleton />
      </section>

      <section className="grid gap-5 2xl:grid-cols-3">
        <HistoryCardSkeleton />
        <HistoryCardSkeleton />
        <HistoryCardSkeleton />
      </section>
    </div>
  );
}
