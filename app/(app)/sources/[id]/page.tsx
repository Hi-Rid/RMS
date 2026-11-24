import { notFound } from "next/navigation";
import { getSourceById } from "@/lib/queries/sources";
import { SourceDetailClient } from "./source-detail-client";

export const instant = false;

interface SourceDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SourceDetailPage({ params }: SourceDetailPageProps) {
  const { id } = await params;
  const data = await getSourceById(id);

  if (!data) {
    notFound();
  }

  return <SourceDetailClient data={data} />;
}
