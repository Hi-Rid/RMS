import { Bookmark } from "lucide-react";
import { PlaceholderPage } from "@/components/app/placeholder-page";

export default function ReferencesPage() {
  return (
    <PlaceholderPage
      title="References Library"
      description="Explore, search, and filter all saved references by pillar, format, platform, and Unused status."
      phase="Prompt P5"
      icon={<Bookmark className="size-6" />}
    />
  );
}
