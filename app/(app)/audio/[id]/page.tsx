import { notFound } from "next/navigation";
import { getAudioById } from "@/lib/queries/audio";
import { AudioDetailClient } from "./audio-detail-client";

export const instant = false;

interface AudioDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AudioDetailPage({ params }: AudioDetailPageProps) {
  const { id } = await params;
  const data = await getAudioById(id);

  if (!data) {
    notFound();
  }

  return <AudioDetailClient data={data} />;
}
