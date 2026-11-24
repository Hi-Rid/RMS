import { notFound } from "next/navigation";
import { getContentById } from "@/lib/queries/contents";
import { getMasterData } from "@/lib/queries/references";
import { ContentStudioClient } from "./content-studio-client";

export const instant = false;

interface ContentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ContentDetailPage({ params }: ContentDetailPageProps) {
  const { id } = await params;

  const [content, masterData] = await Promise.all([
    getContentById(id),
    getMasterData(),
  ]);

  if (!content) {
    notFound();
  }

  return <ContentStudioClient content={content} masterData={masterData} />;
}
