import { listSnapshots } from "@/lib/queries/snapshots";
import { EvaluateClient } from "./evaluate-client";

export const instant = false;

interface EvaluatePageProps {
  searchParams: Promise<{
    filter?: "due" | "upcoming" | "done";
  }>;
}

export default async function EvaluatePage({ searchParams }: EvaluatePageProps) {
  const { filter = "due" } = await searchParams;

  const { items, counts } = await listSnapshots({ filter });

  return (
    <EvaluateClient
      initialItems={items}
      counts={counts}
      activeTab={filter}
    />
  );
}
