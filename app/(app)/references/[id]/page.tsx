import { Bookmark } from "lucide-react";
import { PlaceholderPage } from "@/components/app/placeholder-page";

export default async function ReferenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PlaceholderPage
      title={`Reference Detail`}
      description={`Inspect images, quick capture details, hook breakdowns, and linked contents for reference ${id}.`}
      phase="Prompt P5"
      icon={<Bookmark className="size-6" />}
      backHref="/references"
      backLabel="Back to References"
    />
  );
}
