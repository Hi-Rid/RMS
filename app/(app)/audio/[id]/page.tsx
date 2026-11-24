import { Music } from "lucide-react";
import { PlaceholderPage } from "@/components/app/placeholder-page";

export default async function AudioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PlaceholderPage
      title="Audio Detail"
      description={`Inspect references and contents utilizing audio ${id}, and manage sound metadata.`}
      phase="Prompt P7"
      icon={<Music className="size-6" />}
      backHref="/audio"
      backLabel="Back to Audio"
    />
  );
}
