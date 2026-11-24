import { Users } from "lucide-react";
import { PlaceholderPage } from "@/components/app/placeholder-page";

export default async function SourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PlaceholderPage
      title="Source Detail"
      description={`View performance stats, notes, and references from source account ${id}.`}
      phase="Prompt P12"
      icon={<Users className="size-6" />}
      backHref="/sources"
      backLabel="Back to Sources"
    />
  );
}
