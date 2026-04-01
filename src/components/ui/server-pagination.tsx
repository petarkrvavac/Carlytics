import Link from "next/link";

import { cn } from "@/lib/utils/cn";
import { getVisiblePages } from "@/lib/utils/pagination";

interface ServerPaginationProps {
  currentPage: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
  className?: string;
}

export function ServerPagination({
  currentPage,
  totalPages,
  hrefForPage,
  className,
}: ServerPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const visiblePages = getVisiblePages(currentPage, totalPages);

  return (
    <div className={cn("mt-4 flex flex-wrap items-center justify-center gap-1.5", className)}>
      {currentPage > 1 ? (
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
      )}

      {visiblePages.map((page) =>
        page === currentPage ? (
          <span
            key={page}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-cyan-300 bg-cyan-400 px-2 text-xs font-semibold text-slate-950"
          >
            {page}
          </span>
        ) : (
          <Link
            key={page}
            href={hrefForPage(page)}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-border bg-surface px-2 text-xs font-semibold text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200"
          >
            {page}
          </Link>
        ),
      )}

      {currentPage < totalPages ? (
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
      )}
    </div>
  );
}