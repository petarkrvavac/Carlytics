import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface/95 p-5 shadow-[0_0_0_1px_rgba(148,163,184,0.14),0_10px_26px_rgba(2,132,199,0.10)] dark:shadow-[0_0_0_1px_rgba(148,163,184,0.03),0_12px_30px_rgba(0,0,0,0.25)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-sm font-semibold tracking-wide text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-xs text-muted", className)} {...props} />
  );
}
