import * as React from "react";
import Link from "next/link";
import {
  listReferences,
  getMasterData,
  type ReferenceSortOption,
} from "@/lib/queries/references";
import { getSidebarCounts } from "@/lib/queries/home";
import { ReferenceFilters } from "./reference-filters";
import { ReferencesGridClient } from "@/components/app/references-grid-client";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { AddLinksDialog } from "@/components/app/add-links-dialog";
import { Button } from "@/components/ui/button";
import {
  Bookmark,
  Archive,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
} from "lucide-react";

export const instant = false;

const PAGE_SIZE = 36;

interface ReferencesPageProps {
  searchParams: Promise<{
    status?: string;
    pillar?: string;
    platform?: string;
    format?: string;
    hookType?: string;
    unused?: string;
    missing?: string;
    archived?: string;
    q?: string;
    sort?: string;
    page?: string;
  }>;
}

function getPaginationRange(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, idx) => idx + 1);
  }
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);

  const range: (number | "ellipsis")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const pageNum = sorted[i];
    if (i > 0 && pageNum - sorted[i - 1] > 1) {
      range.push("ellipsis");
    }
    range.push(pageNum);
  }
  return range;
}

export default async function ReferencesPage({ searchParams }: ReferencesPageProps) {
  const sp = await searchParams;
  const status = sp.status || "all";
  const pillarSlug = sp.pillar || "all";
  const platformSlug = sp.platform || "all";
  const formatSlug = sp.format || "all";
  const hookTypeSlug = sp.hookType || "all";
  const unusedOnly = sp.unused === "1";
  const missingOnly = sp.missing === "1";
  const archived = sp.archived === "1";
  const query = sp.q || "";
  const sort: ReferenceSortOption =
    sp.sort === "oldest" || sp.sort === "updated" || sp.sort === "title"
      ? sp.sort
      : "recent";
  const currentPage = Math.max(1, Number.parseInt(sp.page || "1", 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const [masterData, result, counts] = await Promise.all([
    getMasterData(),
    listReferences({
      status,
      pillarSlug,
      platformSlug,
      formatSlug,
      hookTypeSlug,
      unusedOnly,
      missingOnly,
      searchText: query,
      archived,
      sort,
      limit: PAGE_SIZE,
      offset,
    }),
    getSidebarCounts(),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = result.total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(safePage * PAGE_SIZE, result.total);

  const hasFilters = Boolean(
    status !== "all" ||
      pillarSlug !== "all" ||
      platformSlug !== "all" ||
      formatSlug !== "all" ||
      hookTypeSlug !== "all" ||
      unusedOnly ||
      missingOnly ||
      archived ||
      query.trim() ||
      sort !== "recent"
  );

  const buildPageHref = (targetPage: number) => {
    const p = new URLSearchParams();
    if (status && status !== "all") p.set("status", status);
    if (pillarSlug && pillarSlug !== "all") p.set("pillar", pillarSlug);
    if (platformSlug && platformSlug !== "all") p.set("platform", platformSlug);
    if (formatSlug && formatSlug !== "all") p.set("format", formatSlug);
    if (hookTypeSlug && hookTypeSlug !== "all") p.set("hookType", hookTypeSlug);
    if (unusedOnly) p.set("unused", "1");
    if (missingOnly) p.set("missing", "1");
    if (archived) p.set("archived", "1");
    if (query.trim()) p.set("q", query.trim());
    if (sort !== "recent") p.set("sort", sort);
    if (targetPage > 1) p.set("page", String(targetPage));
    const qs = p.toString();
    return qs ? `/references?${qs}` : "/references";
  };

  const pageNumbers = getPaginationRange(safePage, totalPages);

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-8 lg:px-10 space-y-6">
      <PageHeader
        icon={<Bookmark className="size-6 text-foreground" />}
        title="References Library"
        subtitle={
          archived
            ? "Archived items hidden from active triage and studio views."
            : "All saved hooks, breakdowns, creators, and visual notes across platforms."
        }
        badge={
          <span className="label-mono px-2 py-0.5 rounded-md bg-secondary text-foreground border border-border/80 tabular-nums">
            {result.total} {result.total === 1 ? "item" : "items"}
            {archived ? " · archived" : ""}
          </span>
        }
        actions={
          <>
            {counts.inbox > 0 && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 text-xs font-mono rounded-md gap-1.5"
              >
                <Link href="/inbox/triage">
                  <Sparkles className="size-3.5 text-brand" />
                  <span>Triage Inbox ({counts.inbox})</span>
                </Link>
              </Button>
            )}
            <AddLinksDialog>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs font-mono font-semibold bg-brand text-primary-foreground hover:bg-brand/90 rounded-md gap-1.5"
              >
                <Plus className="size-3.5" />
                <span>Add Links</span>
              </Button>
            </AddLinksDialog>
          </>
        }
      />

      <ReferenceFilters masterData={masterData} counts={counts} />

      {result.items.length === 0 ? (
        archived ? (
          <EmptyState
            icon={<Archive className="size-5 text-muted-foreground" />}
            title={hasFilters ? "No archived items match filters" : "Archive is empty"}
            description="References you archive from Inbox or Library appear here and can be restored anytime."
            primaryAction={{
              label: "Back to Active Library",
              href: "/references",
            }}
          />
        ) : hasFilters ? (
          <EmptyState
            icon={<Search className="size-5 text-muted-foreground" />}
            title="No references match your filters"
            description="Try adjusting your search keywords, hook type, status tab, or pillar selections."
            primaryAction={{
              label: "Clear All Filters",
              href: "/references",
            }}
          />
        ) : (
          <EmptyState
            icon={<Bookmark className="size-5 text-muted-foreground" />}
            title="No references saved yet"
            description="Use Add Links above or open Inbox to paste post URLs from Instagram, TikTok, YouTube, X, or Threads."
            primaryAction={{
              label: "Go to Inbox",
              href: "/inbox",
            }}
          />
        )
      ) : (
        <div className="space-y-6">
          <ReferencesGridClient
            items={result.items}
            masterData={masterData}
            isArchivedView={archived}
          />

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border/80">
              <div className="text-xs font-mono text-muted-foreground tabular-nums">
                Showing {startIdx}–{endIdx} of {result.total} references
                <span className="text-muted-foreground/70">
                  {" "}
                  (Page {safePage} of {totalPages})
                </span>
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                {safePage > 1 ? (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-mono rounded-md gap-1 px-2.5"
                  >
                    <Link href={buildPageHref(safePage - 1)}>
                      <ChevronLeft className="size-3.5" />
                      <span>Prev</span>
                    </Link>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="h-8 text-xs font-mono rounded-md gap-1 px-2.5"
                  >
                    <ChevronLeft className="size-3.5" />
                    <span>Prev</span>
                  </Button>
                )}

                {pageNumbers.map((entry, idx) =>
                  entry === "ellipsis" ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-2 text-xs font-mono text-muted-foreground select-none"
                    >
                      …
                    </span>
                  ) : entry === safePage ? (
                    <span
                      key={entry}
                      aria-current="page"
                      className="h-8 min-w-8 px-2 inline-flex items-center justify-center rounded-md bg-foreground text-background text-xs font-mono font-bold tabular-nums"
                    >
                      {entry}
                    </span>
                  ) : (
                    <Button
                      key={entry}
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-8 min-w-8 px-2 text-xs font-mono rounded-md tabular-nums"
                    >
                      <Link href={buildPageHref(entry)}>{entry}</Link>
                    </Button>
                  )
                )}

                {safePage < totalPages ? (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-mono rounded-md gap-1 px-2.5"
                  >
                    <Link href={buildPageHref(safePage + 1)}>
                      <span>Next</span>
                      <ChevronRight className="size-3.5" />
                    </Link>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="h-8 text-xs font-mono rounded-md gap-1 px-2.5"
                  >
                    <span>Next</span>
                    <ChevronRight className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
