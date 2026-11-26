import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  icon,
  badge,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-6",
        className
      )}
    >
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-display flex items-center gap-2.5">
            {icon}
            <span>{title}</span>
          </h1>
          {badge}
        </div>
        {subtitle && (
          <p className="label-mono text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
