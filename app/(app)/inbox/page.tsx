import Link from "next/link";
import { getInboxReferences, getMasterData } from "@/lib/queries/references";
import { ReferenceCard } from "@/components/app/reference-card";
import { Button } from "@/components/ui/button";
import { Inbox, Play, CheckCheck, Plus } from "lucide-react";
import { AddLinksDialog } from "@/components/app/add-links-dialog";

export const instant = false;

export default async function InboxPage() {
  const [items, masterData] = await Promise.all([
    getInboxReferences(),
    getMasterData(),
  ]);

  const count = items.length;

  return (
    <div className="w-full max-w-6xl py-8 px-4 sm:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-display flex items-center gap-2.5">
              <Inbox className="size-6 text-foreground" />
              <span>Inbox</span>
            </h1>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-foreground text-background">
              {count} {count === 1 ? "item" : "items"}
            </span>
          </div>
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Review, capture pillars & triage newly ingested references
          </p>
        </div>

        <div className="flex items-center gap-2">
          <AddLinksDialog>
            <Button
              variant="outline"
              size="sm"
              className="text-xs font-mono h-8 gap-1.5"
            >
              <Plus className="size-3.5" />
              <span>Add Links</span>
            </Button>
          </AddLinksDialog>

          {count > 0 && (
            <Link href="/inbox/triage">
              <Button
                size="sm"
                className="text-xs font-mono h-8 bg-foreground text-background hover:bg-foreground/90 font-bold gap-1.5"
              >
                <Play className="size-3.5 fill-current" />
                <span>Start Triage</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Content */}
      {count === 0 ? (
        <div className="py-20 text-center rounded-lg border border-dashed border-border bg-card/50 space-y-4">
          <div className="size-12 rounded-md bg-secondary flex items-center justify-center mx-auto text-muted-foreground border border-border">
            <CheckCheck className="size-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto px-4">
            <h3 className="text-sm font-black font-display tracking-tight text-foreground">
              Inbox is Clear
            </h3>
            <p className="text-xs font-mono text-muted-foreground leading-relaxed">
              No new references waiting for triage. Ingest links from your browser, iOS Shortcut, or paste links directly.
            </p>
          </div>
          <div className="pt-2">
            <AddLinksDialog>
              <Button
                size="sm"
                className="text-xs font-mono h-8 bg-foreground text-background font-bold"
              >
                <Plus className="size-3.5 mr-1.5" />
                <span>Ingest References</span>
              </Button>
            </AddLinksDialog>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((ref) => (
            <ReferenceCard
              key={ref.id}
              reference={ref}
              masterData={masterData}
              showTriageActions={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}
