import Link from "next/link";
import { Smartphone } from "lucide-react";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description: string;
  actions?: ReactNode;
  showMobileViewButton?: boolean;
}

export function PageHeader({
  title,
  description,
  actions,
  showMobileViewButton = false,
}: PageHeaderProps) {
  const hasActionRow = Boolean(actions) || showMobileViewButton;

  return (
    <header className="mb-8 flex flex-col gap-5 border-b border-border/70 pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>
      </div>
      {hasActionRow ? (
        <div className="flex flex-wrap items-center gap-3">
          {actions}
          {showMobileViewButton ? (
            <Link
              href="/m"
              className="hidden h-10 items-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-100 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-800 transition hover:border-cyan-500/55 hover:bg-cyan-200 dark:bg-cyan-500/12 dark:text-cyan-200 dark:hover:bg-cyan-500/20 xl:inline-flex"
            >
              <Smartphone size={14} />
              Mobilni prikaz
            </Link>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
