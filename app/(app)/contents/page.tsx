import Link from "next/link";
import { listContents, getStudioMasterOptions } from "@/lib/queries/contents";
import { getMasterData } from "@/lib/queries/references";
import { ContentFilters } from "./content-filters";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  FileVideo,
  Plus,
  CheckSquare,
  Link as LinkIcon,
  Send,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export const instant = false;

interface ContentsPageProps {
  searchParams: Promise<{
    status?: string;
    pillar?: string;
    format?: string;
    series?: string;
    archived?: string;
    q?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 30;

export default async function ContentsPage({ searchParams }: ContentsPageProps) {
  const params = await searchParams;
  const currentPage = Math.max(1, Number.parseInt(params.page || "1", 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const [masterData, studioOptions, contentsData] = await Promise.all([
    getMasterData(),
    getStudioMasterOptions(),
    listContents({
      status: params.status,
      pillarSlug: params.pillar,
      formatSlug: params.format,
      seriesId: params.series,
      archived: params.archived === "1",
      searchText: params.q,
      limit: PAGE_SIZE,
      offset,
    }),
  ]);

  const { items, total } = contentsData;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildPageHref = (pageNum: number) => {
    const qp = new URLSearchParams();
    if (params.status) qp.set("status", params.status);
    if (params.pillar) qp.set("pillar", params.pillar);
    if (params.format) qp.set("format", params.format);
    if (params.series) qp.set("series", params.series);
    if (params.archived) qp.set("archived", params.archived);
    if (params.q) qp.set("q", params.q);
    if (pageNum > 1) qp.set("page", String(pageNum));
    const qs = qp.toString();
    return qs ? `/contents?${qs}` : "/contents";
  };

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-8 lg:px-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-display flex items-center gap-2.5">
              <FileVideo className="size-6 text-foreground" />
              <span>
                {params.archived === "1" ? "Archived Contents" : "Contents Studio"}
              </span>
            </h1>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-secondary text-foreground border border-border">
              {total} {total === 1 ? "content" : "contents"}
            </span>
          </div>
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {params.archived === "1"
              ? "Open any archived content studio to restore or delete permanently"
              : "Plan, script, produce, and track your content pipeline"}
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

      {/* Filters */}
      <ContentFilters masterData={masterData} seriesList={studioOptions.series} />

      {/* Grid of Content Cards */}
      {items.length === 0 ? (
        <div className="py-20 text-center rounded-lg border border-dashed border-border bg-card/40 space-y-4">
          <FileVideo className="size-10 mx-auto text-muted-foreground/60" />
          <div className="space-y-1 max-w-sm mx-auto px-4">
            <h3 className="text-sm font-bold font-display text-foreground">
              {params.archived === "1" ? "No Archived Contents" : "No Content Found"}
            </h3>
            <p className="text-xs font-mono text-muted-foreground">
              {params.archived === "1"
                ? "Archived content pieces will appear here."
                : "Adjust your filters or create a new content piece to start producing."}
            </p>
          </div>
          {params.archived !== "1" && (
            <Link href="/contents/new">
              <Button
                size="sm"
                className="text-xs font-mono h-8 bg-foreground text-background font-bold gap-1.5"
              >
                <Plus className="size-3.5" />
                <span>Create New Content</span>
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <>
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
                          &ldquo;{content.hookText}&rdquo;
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
                            checklistDone ? "text-emerald-700 font-bold" : ""
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

          {totalPages > 1 && (
            <div className="pt-4 border-t border-border/60 flex items-center justify-between gap-4 text-xs font-mono">
              <span className="text-muted-foreground">
                Showing {offset + 1}–{Math.min(offset + items.length, total)} of {total}
              </span>
              <div className="flex items-center gap-2">
                {currentPage > 1 ? (
                  <Link href={buildPageHref(currentPage - 1)}>
                    <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs font-mono gap-1">
                      <ChevronLeft className="size-3.5" />
                      <span>Prev</span>
                    </Button>
                  </Link>
                ) : (
                  <Button variant="outline" size="sm" disabled className="h-8 px-2.5 text-xs font-mono gap-1">
                    <ChevronLeft className="size-3.5" />
                    <span>Prev</span>
                  </Button>
                )}

                <span className="px-2 font-bold text-foreground">
                  Page {currentPage} / {totalPages}
                </span>

                {currentPage < totalPages ? (
                  <Link href={buildPageHref(currentPage + 1)}>
                    <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs font-mono gap-1">
                      <span>Next</span>
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </Link>
                ) : (
                  <Button variant="outline" size="sm" disabled className="h-8 px-2.5 text-xs font-mono gap-1">
                    <span>Next</span>
                    <ChevronRight className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
