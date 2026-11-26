import { listSnapshots } from "@/lib/queries/snapshots";
import { EvaluateClient } from "./evaluate-client";

export const instant = false;

const VALID_FILTERS = new Set(["due", "upcoming", "done", "skipped"] as const);

interface EvaluatePageProps {
  searchParams: Promise<{
    filter?: string;
  }>;
}

export default async function EvaluatePage({ searchParams }: EvaluatePageProps) {
  const params = await searchParams;
  const activeTab = VALID_FILTERS.has(params.filter as "due" | "upcoming" | "done" | "skipped")
    ? (params.filter as "due" | "upcoming" | "done" | "skipped")
    : "due";

  const { items, counts } = await listSnapshots({ filter: activeTab });

  return (
    <EvaluateClient
      initialItems={items}
      counts={counts}
      activeTab={activeTab}
    />
  );
}
