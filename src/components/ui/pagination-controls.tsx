"use client";

import { cn } from "@/lib/utils/cn";
import { getVisiblePages } from "@/lib/utils/pagination";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: PaginationControlsProps) {
  if (totalPages <= 1) {
    return null;
  }

  const visiblePages = getVisiblePages(currentPage, totalPages);

  return (
    <div className={cn("mt-4 flex flex-wrap items-center justify-center gap-1.5", className)}>
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage <= 1}
        className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-55 dark:hover:text-cyan-200"
      >
        Prethodna
      </button>

      {visiblePages.map((page) => (
        <button
          key={page}
          type="button"
          onClick={() => onPageChange(page)}
          className={cn(
            "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-semibold transition",
            currentPage === page
              ? "border-cyan-300 bg-cyan-400 text-slate-950"
              : "border-border bg-surface text-foreground hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200",
          )}
        >
          {page}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage >= totalPages}
        className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-55 dark:hover:text-cyan-200"
      >
        Sljedeća
      </button>
    </div>
  );
}
