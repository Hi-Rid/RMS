import { Layers } from "lucide-react";
import { PlaceholderPage } from "@/components/app/placeholder-page";

export default function ContentsPage() {
  return (
    <PlaceholderPage
      title="Contents"
      description="Manage all your produced content drafts, original posts, linked references, and production checklists."
      phase="Prompt P8"
      icon={<Layers className="size-6" />}
    />
  );
}
