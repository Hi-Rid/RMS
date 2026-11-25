import { notFound } from "next/navigation";
import { getReferenceById, getMasterData } from "@/lib/queries/references";
import { ReferenceDetailClient } from "./reference-detail-client";

export const instant = false;

interface ReferencePageProps {
  params: Promise<{ id: string }>;
}

export default async function ReferenceDetailPage({ params }: ReferencePageProps) {
  const { id } = await params;
  const [reference, masterData] = await Promise.all([
    getReferenceById(id),
    getMasterData(),
  ]);

  if (!reference) {
    notFound();
  }

  return (
    <ReferenceDetailClient
      key={`${reference.id}:${reference.summary ?? ""}:${reference.hookText ?? ""}:${reference.contentId ?? ""}`}
      reference={reference}
      masterData={masterData}
    />
  );
}
