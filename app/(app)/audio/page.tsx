import { listAudios } from "@/lib/queries/audio";
import { AudioListClient } from "@/app/(app)/audio/audio-list-client";
import { Music } from "lucide-react";

export const instant = false;

interface AudioPageProps {
  searchParams: Promise<{
    unused?: string;
    q?: string;
    sort?: "recent" | "title" | "refs";
  }>;
}

export default async function AudioPage({ searchParams }: AudioPageProps) {
  const params = await searchParams;
  const items = await listAudios({
    searchText: params.q,
    sortBy: params.sort,
  });

  const initialUnusedOnly = params.unused === "1";

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-8 lg:px-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-display flex items-center gap-2.5">
              <Music className="size-6 text-foreground" />
              <span>Audio Library</span>
            </h1>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-secondary text-foreground border border-border">
              {items.length} {items.length === 1 ? "track" : "tracks"}
            </span>
          </div>
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Trending sounds, songs, and voiceovers across your inspiration library
          </p>
        </div>
      </div>

      <AudioListClient initialItems={items} initialUnusedOnly={initialUnusedOnly} />
    </div>
  );
}
