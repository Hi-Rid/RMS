import { Layers } from "lucide-react";
import { PlaceholderPage } from "@/components/app/placeholder-page";

export default async function ContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PlaceholderPage
      title="Content Workspace"
      description={`Adaptation notes, multi-platform post links, production checklist, and results table for content ${id}.`}
      phase="Prompt P8"
      icon={<Layers className="size-6" />}
      backHref="/contents"
      backLabel="Back to Contents"
    />
  );
}
