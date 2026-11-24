import Link from "next/link";
import { listContents } from "@/lib/queries/contents";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  FileVideo,
  Plus,
  CheckSquare,
  Link as LinkIcon,
  Send,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";

export const instant = false;

interface ContentsPageProps {
  searchParams: Promise<{
    status?: string;
    pillar?: string;
    format?: string;
    q?: string;
  }>;
}

const statusTabs = [
  { label: "All", value: "all" },
  { label: "Production", value: "production" },
  { label: "Posted", value: "posted" },
  { label: "Evaluating", value: "evaluating" },
];

export default async function ContentsPage({ searchParams }: ContentsPageProps) {
  const params = await searchParams;
  const currentStatus = params.status || "all";

  const { items, total } = await listContents({
    status: params.status,
    pillarSlug: params.pillar,
    formatSlug: params.format,
    searchText: params.q,
  });

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-8 lg:px-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-display flex items-center gap-2.5">
              <FileVideo className="size-6 text-foreground" />
              <span>Contents Studio</span>
            </h1>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-secondary text-foreground border border-border">
              {total} {total === 1 ? "content" : "contents"}
            </span>
          </div>
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Plan, script, produce, and track your content pipeline
          </p>
        </div>

        <Link href="/contents/new">
          <Button
            size="sm"
            className="text-xs font-mono h-8 bg-foreground text-background font-bold gap-1.5"
          >
            <Plus className="size-3.5" />
            <span>New Content</span>
          </Button>
        </Link>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-border/60 pb-1 overflow-x-auto">
        {statusTabs.map((tab) => {
          const isActive = currentStatus === tab.value;
          return (
            <Link
              key={tab.value}
              href={tab.value === "all" ? "/contents" : `/contents?status=${tab.value}`}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all select-none whitespace-nowrap ${
                isActive
                  ? "bg-foreground text-background font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Grid of Content Cards */}
      {items.length === 0 ? (
        <div className="py-20 text-center rounded-lg border border-dashed border-border bg-card/40 space-y-4">
          <FileVideo className="size-10 mx-auto text-muted-foreground/60" />
          <div className="space-y-1 max-w-sm mx-auto px-4">
            <h3 className="text-sm font-bold font-display text-foreground">
              No Content in Pipeline
            </h3>
            <p className="text-xs font-mono text-muted-foreground">
              Create an original content piece or select an ingested reference to start producing.
            </p>
          </div>
          <Link href="/contents/new">
            <Button
              size="sm"
              className="text-xs font-mono h-8 bg-foreground text-background font-bold gap-1.5"
            >
              <Plus className="size-3.5" />
              <span>Create First Content</span>
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((content) => {
            const hasChecklist = content.checklistStats.total > 0;
            const checklistDone =
              hasChecklist &&
              content.checklistStats.done === content.checklistStats.total;

            return (
              <Link
                key={content.id}
                href={`/contents/${content.id}`}
                className="group bg-card border border-border rounded-md p-5 space-y-3.5 transition-all hover:border-foreground/40 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {content.format && (
                        <span className="text-[11px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground border border-border font-bold">
                          {content.format.name}
                        </span>
                      )}
                      {content.series && (
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/60">
                          {content.series.name}
                        </span>
                      )}
                    </div>
                    <StatusBadge status={content.status} size="sm" />
                  </div>

                  {/* Title & Hook */}
                  <div className="space-y-1">
                    <h3 className="text-sm font-black font-display tracking-tight text-foreground group-hover:underline underline-offset-2 line-clamp-2">
                      {content.title}
                    </h3>
                    {content.hookText && (
                      <p className="text-xs font-mono text-muted-foreground line-clamp-2">
                        "{content.hookText}"
                      </p>
                    )}
                  </div>

                  {/* Pillars */}
                  {content.pillars.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {content.pillars.map((pillar) => (
                        <span
                          key={pillar.id}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/80 text-foreground border border-border/80 font-medium"
                        >
                          {pillar.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Stats */}
                <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-2 text-[11px] font-mono text-muted-foreground">
                  <div className="flex items-center gap-3">
                    {hasChecklist && (
                      <span
                        className={`flex items-center gap-1 ${
                          checklistDone ? "text-emerald-700 dark:text-emerald-400 font-bold" : ""
                        }`}
                      >
                        <CheckSquare className="size-3" />
                        <span>
                          {content.checklistStats.done}/{content.checklistStats.total}
                        </span>
                      </span>
                    )}

                    {content.refsCount > 0 && (
                      <span className="flex items-center gap-1">
                        <LinkIcon className="size-3" />
                        <span>{content.refsCount} ref{content.refsCount > 1 ? "s" : ""}</span>
                      </span>
                    )}

                    {content.postsCount > 0 && (
                      <span className="flex items-center gap-1 text-foreground font-semibold">
                        <Send className="size-3" />
                        <span>{content.postsCount} post{content.postsCount > 1 ? "s" : ""}</span>
                      </span>
                    )}
                  </div>

                  {content.plannedFor && (
                    <span className="flex items-center gap-1 text-muted-foreground/80">
                      <Calendar className="size-3" />
                      <span>{content.plannedFor}</span>
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
