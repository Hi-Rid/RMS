import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "outline";
  icon?: React.ReactNode;
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
}: EmptyStateProps) {
  const renderAction = (action: EmptyStateAction, isPrimary: boolean) => {
    const classes = isPrimary
      ? "h-8 text-xs font-mono font-bold bg-foreground text-background hover:bg-foreground/90 rounded-md gap-1.5"
      : "h-8 text-xs font-mono rounded-md gap-1.5";

    if (action.href) {
      return (
        <Button asChild size="sm" variant={isPrimary ? "default" : "outline"} className={classes}>
          <Link href={action.href}>
            {action.icon}
            <span>{action.label}</span>
          </Link>
        </Button>
      );
    }

    return (
      <Button
        type="button"
        size="sm"
        variant={isPrimary ? "default" : "outline"}
        onClick={action.onClick}
        className={classes}
      >
        {action.icon}
        <span>{action.label}</span>
      </Button>
    );
  };

  return (
    <div
      className={cn(
        "py-16 px-4 text-center rounded-lg border border-dashed border-border bg-card/50 space-y-4",
        className
      )}
    >
      <div className="mx-auto size-10 rounded-md border border-border bg-secondary flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div className="space-y-1.5 max-w-md mx-auto">
        <h3 className="text-base font-bold font-display text-foreground tracking-tight">
          {title}
        </h3>
        <p className="text-xs font-mono text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {primaryAction && renderAction(primaryAction, true)}
          {secondaryAction && renderAction(secondaryAction, false)}
        </div>
      )}
    </div>
  );
}
