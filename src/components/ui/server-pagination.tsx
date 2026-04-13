import Link from "next/link";

import { cn } from "@/lib/utils/cn";
import { getVisiblePages } from "@/lib/utils/pagination";

interface ServerPaginationProps {
  currentPage: number;
  totalPages: number;
  hrefForPage?: (page: number) => string;
  onPageChange?: (page: number) => void;
  className?: string;
  showWhenSinglePage?: boolean;
}

export function ServerPagination({
  currentPage,
  totalPages,
  hrefForPage,
  onPageChange,
  className,
  showWhenSinglePage = false,
}: ServerPaginationProps) {
  if (totalPages <= 1 && !showWhenSinglePage) {
    return null;
  }

  const visiblePages = getVisiblePages(currentPage, totalPages);

  return (
    <div className={cn("mt-4 flex flex-wrap items-center justify-center gap-1.5", className)}>
      {currentPage > 1 ? (
        onPageChange ? (
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200"
          >
            Prethodna
          </button>
        ) : hrefForPage ? (
          <Link
            href={hrefForPage(currentPage - 1)}
            className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200"
          >
            Prethodna
          </Link>
        ) : (
          <span className="inline-flex h-8 cursor-not-allowed items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground opacity-55">
            Prethodna
          </span>
        )
      ) : (
        <span className="inline-flex h-8 cursor-not-allowed items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground opacity-55">
          Prethodna
        </span>
      )}

      {visiblePages.map((page) =>
        page === currentPage ? (
          <span
            key={page}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-cyan-300 bg-cyan-400 px-2 text-xs font-semibold text-slate-950"
          >
            {page}
          </span>
        ) : onPageChange ? (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-border bg-surface px-2 text-xs font-semibold text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200"
          >
            {page}
          </button>
        ) : hrefForPage ? (
          <Link
            key={page}
            href={hrefForPage(page)}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-border bg-surface px-2 text-xs font-semibold text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200"
          >
            {page}
          </Link>
        ) : (
          <span
            key={page}
            className="inline-flex h-8 min-w-8 cursor-not-allowed items-center justify-center rounded-lg border border-border bg-surface px-2 text-xs font-semibold text-foreground opacity-55"
          >
            {page}
          </span>
        ),
      )}

      {currentPage < totalPages ? (
        onPageChange ? (
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200"
          >
            Sljedeća
          </button>
        ) : hrefForPage ? (
          <Link
            href={hrefForPage(currentPage + 1)}
            className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200"
          >
            Sljedeća
          </Link>
        ) : (
          <span className="inline-flex h-8 cursor-not-allowed items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground opacity-55">
            Sljedeća
          </span>
        )
      ) : (
        <span className="inline-flex h-8 cursor-not-allowed items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground opacity-55">
          Sljedeća
        </span>
      )}
    </div>
  );
}