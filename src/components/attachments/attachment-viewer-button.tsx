"use client";

import { useMemo, useState } from "react";
import { ExternalLink, ImageIcon, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

interface AttachmentViewerButtonProps {
  attachmentSource: string | null | undefined;
  buttonLabel?: string;
  title?: string;
  className?: string;
}

function normalizeAttachmentUrls(attachmentSource: string | null | undefined) {
  if (!attachmentSource) {
    return [];
  }

  const trimmed = attachmentSource.trim();

  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);

      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter((item) => item.length > 0);
      }
    } catch {
      // Fallback na niže parsere
    }
  }

  if (trimmed.includes(",")) {
    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [trimmed];
}

function toAttachmentLabel(url: string, index: number) {
  const urlWithoutQuery = url.split("?")[0] ?? url;
  const lastPart = urlWithoutQuery.split("/").pop();

  if (lastPart && lastPart.trim()) {
    return decodeURIComponent(lastPart);
  }

  return `Slika ${index + 1}`;
}

export function AttachmentViewerButton({
  attachmentSource,
  buttonLabel = "Prikaz slika",
  title = "Privitci prijave",
  className,
}: AttachmentViewerButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const attachments = useMemo(() => normalizeAttachmentUrls(attachmentSource), [attachmentSource]);

  if (attachments.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200",
          className,
        )}
      >
        <ImageIcon size={13} />
        {buttonLabel}
        <Badge variant="info" className="h-5 px-1.5 text-[10px]">
          {attachments.length}
        </Badge>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-70 px-3 py-4 sm:p-6">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            aria-label="Zatvori prikaz privitaka"
          />

          <div className="relative mx-auto flex h-[min(86vh,760px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[0_0_0_1px_rgba(15,23,42,0.6),0_28px_80px_rgba(2,6,23,0.7)]">
            <div className="flex items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Privitci</p>
                <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">{title}</h3>
                <p className="mt-1 text-xs text-muted">Ukupno slika: {attachments.length}</p>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:border-cyan-500/45 hover:text-cyan-200"
                aria-label="Zatvori modal"
              >
                <X size={15} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              <ul className="space-y-2">
                {attachments.map((url, index) => (
                  <li key={`${url}-${index}`} className="rounded-xl border border-border bg-surface px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="truncate text-sm text-foreground" title={url}>
                        {toAttachmentLabel(url, index)}
                      </p>

                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-700 dark:hover:text-cyan-200"
                      >
                        Otvori
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
