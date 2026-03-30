import Link from "next/link";
import { Warehouse } from "lucide-react";

import { cn } from "@/lib/utils/cn";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onActionClick?: () => void;
  className?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onActionClick,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-surface/92 p-8",
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full bg-cyan-500/10 blur-2xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4">
          <div className="mt-1 h-10 w-10 shrink-0 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 dark:border-border dark:bg-slate-900/70 dark:text-cyan-300">
            <Warehouse className="mx-auto mt-1.75" size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="mt-2 max-w-xl text-sm text-muted">{description}</p>
          </div>
        </div>
        {actionLabel && onActionClick ? (
          <button
            type="button"
            onClick={onActionClick}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-100 px-4 text-sm font-medium text-cyan-800 transition hover:border-cyan-400/70 hover:bg-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
          >
            {actionLabel}
          </button>
        ) : null}
        {actionLabel && actionHref && !onActionClick ? (
          <Link
            href={actionHref}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-100 px-4 text-sm font-medium text-cyan-800 transition hover:border-cyan-400/70 hover:bg-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
