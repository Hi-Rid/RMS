import { Users } from "lucide-react";
import { PlaceholderPage } from "@/components/app/placeholder-page";

export default function SourcesPage() {
  return (
    <PlaceholderPage
      title="Source Accounts"
      description="Analyze reference creator handles per platform. Track conversion rates from saved references to posted contents."
      phase="Prompt P12"
      icon={<Users className="size-6" />}
    />
  );
}
