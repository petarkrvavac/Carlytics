const tableColumns = Array.from({ length: 9 });
const tableRows = Array.from({ length: 8 });

export default function ZaposleniciLoading() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface/95 p-5">
        <div className="space-y-3">
          <div className="skeleton-shimmer h-8 w-52 animate-pulse rounded-lg bg-surface-elevated" />
          <div className="skeleton-shimmer h-4 w-full max-w-2xl animate-pulse rounded-md bg-surface-elevated" />
          <div className="skeleton-shimmer h-4 w-3/5 animate-pulse rounded-md bg-surface-elevated" />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <div className="skeleton-shimmer h-10 w-44 animate-pulse rounded-xl bg-surface-elevated" />
          <div className="skeleton-shimmer h-10 w-44 animate-pulse rounded-xl bg-surface-elevated" />
          <div className="skeleton-shimmer h-10 w-48 animate-pulse rounded-xl bg-surface-elevated" />
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-surface/95 p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="skeleton-shimmer h-5 w-5 animate-pulse rounded-md bg-surface-elevated" />
          <div className="skeleton-shimmer h-3.5 w-32 animate-pulse rounded-md bg-surface-elevated" />
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="skeleton-shimmer h-8 w-22 animate-pulse rounded-lg bg-surface-elevated" />
          <div className="skeleton-shimmer h-8 w-28 animate-pulse rounded-lg bg-surface-elevated" />
          <div className="skeleton-shimmer h-8 w-20 animate-pulse rounded-lg bg-surface-elevated" />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface/95 p-0">
        <div className="overflow-x-auto">
          <div className="min-w-245 p-3">
            <div className="grid grid-cols-9 gap-2 border-b border-border pb-3">
              {tableColumns.map((_, columnIndex) => (
                <div
                  key={`head-${columnIndex}`}
                  className="skeleton-shimmer h-3.5 w-full animate-pulse rounded-md bg-surface-elevated"
                />
              ))}
            </div>

            <div className="mt-2 space-y-2">
              {tableRows.map((_, rowIndex) => (
                <div
                  key={`row-${rowIndex}`}
                  className="grid grid-cols-9 gap-2 rounded-xl border border-border bg-surface p-3"
                >
                  {tableColumns.map((_, columnIndex) => (
                    <div
                      key={`row-${rowIndex}-cell-${columnIndex}`}
                      className={`skeleton-shimmer h-7 animate-pulse rounded-md bg-surface-elevated ${
                        columnIndex === 8 ? "w-20 justify-self-end" : "w-full"
                      }`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
