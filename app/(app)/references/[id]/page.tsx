import { notFound } from "next/navigation";
import {
  getReferenceById,
  getMasterData,
  getSimilarReferences,
} from "@/lib/queries/references";
import { ReferenceDetailClient } from "./reference-detail-client";

export const instant = false;

interface ReferencePageProps {
  params: Promise<{ id: string }>;
}

export default async function ReferenceDetailPage({ params }: ReferencePageProps) {
  const { id } = await params;
  const [reference, masterData, similarReferences] = await Promise.all([
    getReferenceById(id),
    getMasterData(),
    getSimilarReferences(id, 4),
  ]);

  if (!reference) {
    notFound();
  }

  return (
    <ReferenceDetailClient
      key={reference.id}
      reference={reference}
      masterData={masterData}
      similarReferences={similarReferences}
    />
  );
}
