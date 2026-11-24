import { FilePlus } from "lucide-react";
import { PlaceholderPage } from "@/components/app/placeholder-page";

export default function NewContentPage() {
  return (
    <PlaceholderPage
      title="Create Content"
      description="Craft original content or adapt from 1 or more references. Assign hooks, audio, pillars, and checklist."
      phase="Prompt P8"
      icon={<FilePlus className="size-6" />}
      backHref="/contents"
      backLabel="Back to Contents"
    />
  );
}
