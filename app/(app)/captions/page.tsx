import { connection } from "next/server";
import { listSnippets } from "@/lib/queries/captions";
import { getMasterData } from "@/lib/queries/references";
import { CaptionsClient } from "@/app/(app)/captions/captions-client";
import { Quote } from "lucide-react";

export const instant = false;

export default async function CaptionsPage() {
  await connection();
  const [snippets, masterData] = await Promise.all([
    listSnippets(),
    getMasterData(),
  ]);

  return (
    <div className="w-full max-w-6xl py-8 px-4 sm:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-display flex items-center gap-2.5">
              <Quote className="size-6 text-foreground" />
              <span>Captions & Hashtags</span>
            </h1>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-secondary text-foreground border border-border">
              {snippets.length} Saved
            </span>
          </div>
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Reusable high-conversion caption templates, hooks & optimized hashtag sets
          </p>
        </div>
      </div>

      <CaptionsClient
        initialSnippets={snippets}
        pillars={masterData.pillars}
        platforms={masterData.platforms}
      />
    </div>
  );
}
