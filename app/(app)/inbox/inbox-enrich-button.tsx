"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { enrichInboxBatch } from "@/lib/actions/references";

interface InboxEnrichButtonProps {
  unenrichedCount?: number;
  aiKeyReady?: boolean;
  aiEnabled?: boolean;
}

export function InboxEnrichButton({
  unenrichedCount = 0,
  aiKeyReady = true,
  aiEnabled = true,
}: InboxEnrichButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!aiKeyReady || !aiEnabled) {
    return (
      <Button
        asChild
        variant="outline"
        size="sm"
        className="text-xs font-mono h-8 rounded-md gap-1.5 border-warning/40 text-warning hover:bg-warning/10"
      >
        <Link href="/settings?tab=ai">
          <Settings className="size-3.5" />
          <span>{!aiKeyReady ? "Setup AI Enrich" : "Enable AI Enrich"}</span>
        </Link>
      </Button>
    );
  }

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

      if (enrichedCount === 0 && draftedCount === 0) {
        toast.warning(
          `Checked ${processedCount} item${processedCount > 1 ? "s" : ""}, but none could be enriched. Check your Gemini API key or AI settings.`,
          {
            action: {
              label: "AI Settings",
              onClick: () => router.push("/settings?tab=ai"),
            },
          }
        );
        router.refresh();
        return;
      }

      if (draftedCount > 0) {
        toast.success(
          `AI Agent processed ${processedCount} items: ${enrichedCount} enriched & ${draftedCount} drafted to Studio!`,
          {
            action: {
              label: "Start Triage",
              onClick: () => router.push("/inbox/triage"),
            },
          }
        );
      } else {
        toast.success(
          `AI Agent enriched ${enrichedCount} of ${processedCount} inbox item${processedCount > 1 ? "s" : ""}.`,
          {
            action: {
              label: "Start Triage",
              onClick: () => router.push("/inbox/triage"),
            },
          }
        );
      }
      router.refresh();
    });
  }

  const batchLabel =
    unenrichedCount > 5
      ? "AI Enrich Next 5"
      : unenrichedCount > 0
      ? `AI Enrich (${unenrichedCount})`
      : "AI Auto-Enrich";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={handleEnrich}
      title="Enriches up to 5 inbox items missing summary or hook per batch"
      className="text-xs font-mono h-8 rounded-md gap-1.5 border-brand/35 text-brand hover:bg-brand/5"
    >
      {isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Sparkles className="size-3.5" />
      )}
      <span>{isPending ? "Enriching batch..." : batchLabel}</span>
    </Button>
  );
}
