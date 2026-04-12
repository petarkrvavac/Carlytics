"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, ImageIcon, X } from "lucide-react";

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
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedImageIndexes, setFailedImageIndexes] = useState<number[]>([]);
  const attachments = useMemo(() => normalizeAttachmentUrls(attachmentSource), [attachmentSource]);

  const currentAttachment = attachments[activeIndex] ?? null;
  const canPreviewImage = currentAttachment !== null && !failedImageIndexes.includes(activeIndex);
  const isSingleAttachment = attachments.length === 1;

  const openModal = () => {
    setActiveIndex(0);
    setFailedImageIndexes([]);
    setIsOpen(true);
  };

  const showPrevious = () => {
    setActiveIndex((current) => (current <= 0 ? attachments.length - 1 : current - 1));
  };

  const showNext = () => {
    setActiveIndex((current) => (current >= attachments.length - 1 ? 0 : current + 1));
  };

  const markCurrentImageAsFailed = () => {
    setFailedImageIndexes((current) =>
      current.includes(activeIndex) ? current : [...current, activeIndex],
    );
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isOpen]);

  if (attachments.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
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
        <div
          className={cn(
            "fixed inset-0 z-70",
            isSingleAttachment ? "p-0" : "px-3 py-4 sm:p-6",
          )}
        >
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            aria-label="Zatvori prikaz privitaka"
          />

          <div
            className={cn(
              "relative mx-auto flex w-full flex-col overflow-hidden bg-background shadow-[0_0_0_1px_rgba(15,23,42,0.6),0_28px_80px_rgba(2,6,23,0.7)]",
              isSingleAttachment
                ? "h-full max-w-none rounded-none border-0"
                : "h-[min(86vh,760px)] max-w-3xl rounded-2xl border border-border",
            )}
          >
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

            <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4">
              <div className={cn("grid h-full gap-3", isSingleAttachment ? "grid-cols-1" : "md:grid-cols-[0.9fr_1.1fr]")}>
                {!isSingleAttachment ? (
                  <div className="min-h-0 overflow-y-auto rounded-xl border border-border bg-surface p-2">
                    <ul className="space-y-1.5">
                      {attachments.map((url, index) => (
                        <li key={`${url}-${index}`}>
                          <button
                            type="button"
                            onClick={() => setActiveIndex(index)}
                            className={cn(
                              "flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition",
                              activeIndex === index
                                ? "border-cyan-400/65 bg-cyan-500/15 text-cyan-100"
                                : "border-border bg-background text-foreground hover:border-cyan-500/45 hover:text-cyan-200",
                            )}
                          >
                            <span className="truncate" title={url}>
                              {toAttachmentLabel(url, index)}
                            </span>
                            <Badge variant="info" className="h-5 px-1.5 text-[10px]">
                              {index + 1}
                            </Badge>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="flex min-h-0 flex-col rounded-xl border border-border bg-surface p-2">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-muted" title={currentAttachment ?? ""}>
                      {currentAttachment ? toAttachmentLabel(currentAttachment, activeIndex) : "Nema odabrane slike"}
                    </p>

                    {attachments.length > 1 ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={showPrevious}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-foreground transition hover:border-cyan-500/45 hover:text-cyan-200"
                          aria-label="Prethodna slika"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={showNext}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-foreground transition hover:border-cyan-500/45 hover:text-cyan-200"
                          aria-label="Sljedeća slika"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border border-border bg-background p-2">
                    {currentAttachment ? (
                      canPreviewImage ? (
                        // Prikazujemo sliku direktno u modalu bez dodatnog preusmjeravanja.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={currentAttachment}
                          alt={toAttachmentLabel(currentAttachment, activeIndex)}
                          className={cn(
                            "h-full w-full object-contain",
                            isSingleAttachment ? "max-h-none" : "max-h-[58vh]",
                          )}
                          loading="eager"
                          onError={markCurrentImageAsFailed}
                        />
                      ) : (
                        <div className="text-center">
                          <p className="text-sm text-muted">Privitak nije moguće prikazati unutar pregleda.</p>
                          <a
                            href={currentAttachment}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition hover:border-cyan-500/45 hover:text-cyan-200"
                          >
                            Otvori original
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      )
                    ) : (
                      <p className="text-sm text-muted">Nema dostupnog privitka.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
