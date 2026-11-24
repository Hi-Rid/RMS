import { getMasterData, getReferenceById } from "@/lib/queries/references";
import { NewContentClient } from "./new-content-client";

export const instant = false;

interface NewContentPageProps {
  searchParams: Promise<{
    refId?: string;
  }>;
}

export default async function NewContentPage({ searchParams }: NewContentPageProps) {
  const { refId } = await searchParams;

  const [masterData, sourceReference] = await Promise.all([
    getMasterData(),
    refId ? getReferenceById(refId) : Promise.resolve(null),
  ]);

  return (
    <NewContentClient
      masterData={masterData}
      sourceReference={sourceReference}
    />
  );
}
