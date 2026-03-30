export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      <div className="h-16 animate-pulse rounded-2xl border border-border bg-surface" />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.8fr)]">
        <div className="grid gap-5">
          <div className="h-64 animate-pulse rounded-2xl border border-border bg-surface" />
          <div className="h-64 animate-pulse rounded-2xl border border-border bg-surface" />
        </div>

        <div className="h-133 animate-pulse rounded-2xl border border-border bg-surface" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.8fr)]">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-64 animate-pulse rounded-2xl border border-border bg-surface" />
          <div className="h-64 animate-pulse rounded-2xl border border-border bg-surface" />
          <div className="h-64 animate-pulse rounded-2xl border border-border bg-surface" />
          <div className="h-64 animate-pulse rounded-2xl border border-border bg-surface" />
        </div>

        <div className="h-128 animate-pulse rounded-2xl border border-border bg-surface" />
      </div>
    </div>
  );
}
