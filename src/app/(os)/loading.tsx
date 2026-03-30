const cardRows = Array.from({ length: 4 });

export default function OsRouteLoading() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-surface/95 p-5">
        <div className="space-y-3">
          <div className="skeleton-shimmer h-8 w-56 animate-pulse rounded-lg bg-surface-elevated" />
          <div className="skeleton-shimmer h-4 w-full max-w-2xl animate-pulse rounded-md bg-surface-elevated" />
          <div className="skeleton-shimmer h-4 w-3/5 animate-pulse rounded-md bg-surface-elevated" />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)]">
        <section className="rounded-2xl border border-border bg-surface/95 p-5">
          <div className="skeleton-shimmer h-4 w-44 animate-pulse rounded-md bg-surface-elevated" />

          <div className="mt-4 space-y-3">
            {cardRows.map((_, index) => (
              <div key={`left-${index}`} className="rounded-xl border border-border bg-surface p-4">
                <div className="skeleton-shimmer h-4 w-3/5 animate-pulse rounded-md bg-surface-elevated" />
                <div className="mt-2 skeleton-shimmer h-3.5 w-full animate-pulse rounded-md bg-surface-elevated" />
                <div className="mt-2 skeleton-shimmer h-3.5 w-4/5 animate-pulse rounded-md bg-surface-elevated" />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface/95 p-5">
          <div className="skeleton-shimmer h-4 w-36 animate-pulse rounded-md bg-surface-elevated" />

          <div className="mt-4 space-y-2.5">
            {cardRows.map((_, index) => (
              <div key={`right-${index}`} className="rounded-lg border border-border bg-surface p-3">
                <div className="skeleton-shimmer h-4 w-2/3 animate-pulse rounded-md bg-surface-elevated" />
                <div className="mt-2 skeleton-shimmer h-3.5 w-full animate-pulse rounded-md bg-surface-elevated" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
