import { Music } from "lucide-react";
import { PlaceholderPage } from "@/components/app/placeholder-page";

export default function AudioPage() {
  return (
    <PlaceholderPage
      title="Audio Library"
      description="Track sound tracks, songs, and original voices. See last used dates, unused tracks, and content count."
      phase="Prompt P7"
      icon={<Music className="size-6" />}
    />
  );
}
