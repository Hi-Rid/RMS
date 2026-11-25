"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { enrichInboxBatch } from "@/lib/actions/references";

export function InboxEnrichButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleEnrich() {
    startTransition(async () => {
      const res = await enrichInboxBatch();
      if (!res.ok) {
        toast.error(res.error.message || "Failed to run AI enrich batch");
        return;
      }

      const { processedCount, enrichedCount, draftedCount } = res.data;
      if (processedCount === 0) {
        toast.info("All inbox items already have AI summaries & hooks.");
        return;
      }

      if (draftedCount > 0) {
        toast.success(
          `AI Agent processed ${processedCount} items: ${enrichedCount} enriched & ${draftedCount} drafted to Studio!`
        );
      } else {
        toast.success(
          `AI Agent processed ${processedCount} items (${enrichedCount} enriched with summary & tags).`
        );
      }
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={handleEnrich}
      className="text-xs font-mono h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
    >
      {isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Sparkles className="size-3.5" />
      )}
      <span>{isPending ? "Enriching..." : "AI Auto-Enrich"}</span>
    </Button>
  );
}
