import { listAudios, type AudioSortOption } from "@/lib/queries/audio";
import { AudioListClient } from "@/app/(app)/audio/audio-list-client";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Music, Bookmark } from "lucide-react";
import Link from "next/link";

export const instant = false;

interface AudioPageProps {
  searchParams: Promise<{
    filter?: string;
    unused?: string;
    q?: string;
    sort?: string;
  }>;
}

export default async function AudioPage({ searchParams }: AudioPageProps) {
  const params = await searchParams;
  const items = await listAudios();

  const initialScope: "all" | "unused" | "used" | "original" =
    params.filter === "unused" || params.unused === "1"
      ? "unused"
      : params.filter === "used"
        ? "used"
        : params.filter === "original"
          ? "original"
          : "all";

  const validSorts: AudioSortOption[] = [
    "recent",
    "refs",
    "contents",
    "rating",
    "newest",
    "title",
  ];
  const initialSort: AudioSortOption = validSorts.includes(
    params.sort as AudioSortOption
  )
    ? (params.sort as AudioSortOption)
    : "recent";

  const unusedCount = items.filter((item) => item.isUnused).length;

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-8 lg:px-10 space-y-6">
      <PageHeader
        title="Audio Library"
        subtitle="Trending sounds, songs, and voiceovers across your references and content studio"
        icon={<Music className="size-6 text-foreground" />}
        badge={
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-secondary text-foreground border border-border tabular-nums">
            {items.length} {items.length === 1 ? "track" : "tracks"}
            {unusedCount > 0 ? ` · ${unusedCount} unused` : ""}
          </span>
        }
        actions={
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 text-xs font-mono rounded-md gap-1.5"
          >
            <Link href="/references">
              <Bookmark className="size-3.5 text-muted-foreground" />
              <span>References</span>
            </Link>
          </Button>
        }
      />

      <AudioListClient
        initialItems={items}
        initialScope={initialScope}
        initialQuery={params.q || ""}
        initialSort={initialSort}
      />
    </div>
  );
}
