import Link from "next/link";
import { listReferences, getMasterData } from "@/lib/queries/references";
import { getAppSettings } from "@/lib/queries/settings";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Inbox, Play, Plus } from "lucide-react";
import { AddLinksDialog } from "@/components/app/add-links-dialog";
import { InboxBookmarkletIngest } from "@/components/app/inbox-bookmarklet-ingest";
import { InboxEnrichButton } from "./inbox-enrich-button";
import { InboxClient } from "./inbox-client";

export const instant = false;

interface InboxPageProps {
  searchParams: Promise<{ add?: string }>;
}

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const params = await searchParams;
  const [inboxResult, masterData, settings] = await Promise.all([
    listReferences({ status: "inbox", limit: 100 }),
    getMasterData(),
    getAppSettings(),
  ]);

  const items = inboxResult.items;
  const totalCount = inboxResult.total;
  const unenrichedCount = items.filter((i) => !i.summary || !i.hookText).length;
  const aiKeyReady = Boolean(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      settings.hasPersonalAiKey
  );

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-8 lg:px-10 space-y-6">
      <InboxBookmarkletIngest addUrl={params.add} />

      <PageHeader
        title="Inbox"
        subtitle="Review, enrich metadata, assign pillars & triage newly ingested links"
        icon={<Inbox className="size-6 text-foreground" />}
        badge={
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-foreground text-background tabular-nums">
            {totalCount} {totalCount === 1 ? "item" : "items"}
          </span>
        }
        actions={
          <>
            {items.length > 0 && unenrichedCount > 0 && (
              <InboxEnrichButton
                unenrichedCount={unenrichedCount}
                aiKeyReady={aiKeyReady}
                aiEnabled={settings.aiEnabled}
              />
            )}

            <AddLinksDialog>
              <Button variant="outline" size="sm" className="text-xs font-mono h-8 rounded-md gap-1.5">
                <Plus className="size-3.5" />
                <span>Batch / File</span>
              </Button>
            </AddLinksDialog>

            {items.length > 0 && (
              <Button
                asChild
                size="sm"
                className="text-xs font-mono h-8 rounded-md bg-brand text-brand-foreground hover:bg-brand/90 font-bold gap-1.5"
              >
                <Link href="/inbox/triage">
                  <Play className="size-3.5 fill-current" />
                  <span>Start Focus Triage</span>
                </Link>
              </Button>
            )}
          </>
        }
      />

      {totalCount > items.length && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-border bg-secondary/40 text-xs font-mono">
          <span className="text-muted-foreground">
            Showing the newest {items.length} of {totalCount} inbox items.
          </span>
          <Link
            href="/references?status=inbox"
            className="font-semibold text-foreground underline underline-offset-4 hover:text-brand"
          >
            Browse all in References →
          </Link>
        </div>
      )}

      <InboxClient
        items={items}
        masterData={masterData}
        aiKeyReady={aiKeyReady}
        aiEnabled={settings.aiEnabled}
      />
    </div>
  );
}
