import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusVariant =
  | "inbox"
  | "selected"
  | "production"
  | "posted"
  | "evaluating"
  | "skipped"
  | "pending"
  | "done";

interface StatusBadgeProps {
  status: string;
  className?: string;
  size?: "sm" | "default";
}

const statusConfig: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  inbox: {
    label: "INBOX",
    bg: "bg-muted/70",
    text: "text-muted-foreground",
    border: "border-border/80",
  },
  selected: {
    label: "SELECTED",
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    text: "text-amber-800 dark:text-amber-400",
    border: "border-amber-500/30",
  },
  production: {
    label: "PRODUCTION",
    bg: "bg-blue-500/10 dark:bg-blue-500/20",
    text: "text-blue-800 dark:text-blue-400",
    border: "border-blue-500/30",
  },
  posted: {
    label: "POSTED",
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    text: "text-emerald-800 dark:text-emerald-400",
    border: "border-emerald-500/30",
  },
  evaluating: {
    label: "EVALUATING",
    bg: "bg-purple-500/10 dark:bg-purple-500/20",
    text: "text-purple-800 dark:text-purple-400",
    border: "border-purple-500/30",
  },
  skipped: {
    label: "SKIPPED",
    bg: "bg-muted/40",
    text: "text-muted-foreground/80 line-through",
    border: "border-border/40",
  },
  pending: {
    label: "PENDING",
    bg: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-500/30",
  },
  done: {
    label: "DONE",
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-500/30",
  },
};

export function StatusBadge({ status, className, size = "default" }: StatusBadgeProps) {
  const norm = status.toLowerCase();
  const config = statusConfig[norm] || {
    label: status.toUpperCase(),
    bg: "bg-secondary",
    text: "text-secondary-foreground",
    border: "border-border",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-mono font-medium uppercase tracking-wider rounded border select-none transition-colors",
        config.bg,
        config.text,
        config.border,
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        className
      )}
    >
      {config.label}
    </span>
  );
}
