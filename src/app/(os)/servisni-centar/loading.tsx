const timelineRows = Array.from({ length: 6 });
const priorityRows = Array.from({ length: 8 });

export default function ServisniCentarLoading() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-surface/95 p-5">
        <div className="space-y-3">
          <div className="skeleton-shimmer h-8 w-56 animate-pulse rounded-lg bg-surface-elevated" />
          <div className="skeleton-shimmer h-4 w-full max-w-2xl animate-pulse rounded-md bg-surface-elevated" />
          <div className="skeleton-shimmer h-4 w-3/5 animate-pulse rounded-md bg-surface-elevated" />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <div className="skeleton-shimmer h-10 w-44 animate-pulse rounded-xl bg-surface-elevated" />
          <div className="skeleton-shimmer h-10 w-44 animate-pulse rounded-xl bg-surface-elevated" />
          <div className="skeleton-shimmer h-10 w-44 animate-pulse rounded-xl bg-surface-elevated" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-border bg-surface/95 p-5">
          <div className="skeleton-shimmer h-4 w-40 animate-pulse rounded-md bg-surface-elevated" />

          <div className="mt-4 space-y-3">
            {timelineRows.map((_, index) => (
              <div key={`timeline-${index}`} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="skeleton-shimmer h-4 w-3/5 animate-pulse rounded-md bg-surface-elevated" />
                    <div className="skeleton-shimmer h-3.5 w-full animate-pulse rounded-md bg-surface-elevated" />
                    <div className="skeleton-shimmer h-3.5 w-4/5 animate-pulse rounded-md bg-surface-elevated" />
                  </div>

                  <div className="w-28 space-y-2">
                    <div className="skeleton-shimmer h-7 w-full animate-pulse rounded-lg bg-surface-elevated" />
                    <div className="skeleton-shimmer h-3.5 w-4/5 animate-pulse rounded-md bg-surface-elevated" />
                    <div className="skeleton-shimmer h-3.5 w-full animate-pulse rounded-md bg-surface-elevated" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface/95 p-5">
          <div className="skeleton-shimmer h-4 w-36 animate-pulse rounded-md bg-surface-elevated" />

          <div className="mt-4 space-y-2.5">
            {priorityRows.map((_, index) => (
              <div key={`priority-${index}`} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="skeleton-shimmer h-4 w-2/3 animate-pulse rounded-md bg-surface-elevated" />
                    <div className="skeleton-shimmer h-3.5 w-full animate-pulse rounded-md bg-surface-elevated" />
                  </div>

                  <div className="skeleton-shimmer h-7 w-20 animate-pulse rounded-lg bg-surface-elevated" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
