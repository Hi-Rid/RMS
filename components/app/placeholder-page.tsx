import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
} from "@/components/ui/empty";

interface PlaceholderPageProps {
  title: string;
  description: string;
  phase: string;
  icon?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}

export function PlaceholderPage({
  title,
  description,
  phase,
  icon,
  backHref = "/",
  backLabel = "Back to Home",
}: PlaceholderPageProps) {
  return (
    <div className="flex h-full min-h-[75vh] w-full flex-col items-center justify-center p-6">
      <Empty className="max-w-md border border-border bg-card p-10 rounded-lg shadow-none">
        {icon && (
          <EmptyMedia variant="icon" className="size-12 rounded-control bg-secondary text-foreground">
            {icon}
          </EmptyMedia>
        )}
        <EmptyHeader>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
            {phase} · COMING SOON
          </div>
          <EmptyTitle className="text-2xl font-bold font-display text-foreground">
            {title}
          </EmptyTitle>
          <EmptyDescription className="text-xs text-muted-foreground">
            {description}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="mt-2">
          <Link href={backHref}>
            <Button variant="outline" className="h-8 rounded-control text-xs font-mono uppercase tracking-wider">
              <ArrowLeft className="mr-1.5 size-3.5" />
              <span>{backLabel}</span>
            </Button>
          </Link>
        </EmptyContent>
      </Empty>
    </div>
  );
}
