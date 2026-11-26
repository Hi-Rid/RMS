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
    bg: "bg-warning/10",
    text: "text-warning",
    border: "border-warning/30",
  },
  production: {
    label: "PRODUCTION",
    bg: "bg-secondary",
    text: "text-foreground",
    border: "border-foreground/25",
  },
  posted: {
    label: "POSTED",
    bg: "bg-success/10",
    text: "text-success",
    border: "border-success/30",
  },
  evaluating: {
    label: "EVALUATING",
    bg: "bg-brand/10",
    text: "text-brand",
    border: "border-brand/30",
  },
  skipped: {
    label: "SKIPPED",
    bg: "bg-muted/50",
    text: "text-muted-foreground line-through",
    border: "border-border/60",
  },
  pending: {
    label: "PENDING",
    bg: "bg-warning/10",
    text: "text-warning",
    border: "border-warning/30",
  },
  done: {
    label: "DONE",
    bg: "bg-success/10",
    text: "text-success",
    border: "border-success/30",
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
        "inline-flex items-center font-mono font-medium uppercase tracking-wider rounded-md border select-none transition-colors",
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
