"use client";

import { SunMoon } from "lucide-react";

import { cn } from "@/lib/utils/cn";

type AppTheme = "dark" | "light";

const STORAGE_KEY = "carlytics-theme";

function isTheme(value: string | null): value is AppTheme {
  return value === "dark" || value === "light";
}

function applyTheme(theme: AppTheme) {
  const root = document.documentElement;
  const isLight = theme === "light";

  root.classList.toggle("light", isLight);
  root.classList.toggle("dark", !isLight);

  window.localStorage.setItem(STORAGE_KEY, theme);
}

function resolvePreferredTheme(): AppTheme {
  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (isTheme(stored)) {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function resolveCurrentTheme(): AppTheme {
  const root = document.documentElement;

  if (root.classList.contains("light")) {
    return "light";
  }

  if (root.classList.contains("dark")) {
    return "dark";
  }

  return resolvePreferredTheme();
}

interface ThemeToggleProps {
  compact?: boolean;
  className?: string;
}

export function ThemeToggle({ compact = false, className }: ThemeToggleProps) {
  function handleToggle() {
    const nextTheme = resolveCurrentTheme() === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface text-xs font-medium text-muted transition hover:border-cyan-500/45 hover:text-cyan-200",
        compact ? "h-8 w-8" : "h-8 px-2.5",
        className,
      )}
      aria-label="Promijeni temu"
      title="Promijeni temu"
    >
      <SunMoon size={14} />
      {compact ? null : <span>Tema</span>}
    </button>
  );
}
