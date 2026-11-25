import { getMasterData, getReferenceById } from "@/lib/queries/references";
import { getStudioMasterOptions } from "@/lib/queries/contents";
import { NewContentClient } from "./new-content-client";

export const instant = false;

interface NewContentPageProps {
  searchParams: Promise<{
    refId?: string;
    idea?: string;
  }>;
}

export default async function NewContentPage({ searchParams }: NewContentPageProps) {
  const { refId, idea } = await searchParams;

  const [masterData, studioOptions, sourceReference] = await Promise.all([
    getMasterData(),
    getStudioMasterOptions(),
    refId ? getReferenceById(refId) : Promise.resolve(null),
  ]);

  return (
    <NewContentClient
      masterData={masterData}
      studioOptions={studioOptions}
      sourceReference={sourceReference}
      initialIdea={idea || ""}
    />
  );
}
