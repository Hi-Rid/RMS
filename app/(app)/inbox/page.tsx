import { Inbox } from "lucide-react";
import { PlaceholderPage } from "@/components/app/placeholder-page";

export default function InboxPage() {
  return (
    <PlaceholderPage
      title="Inbox"
      description="Quickly capture, triage, and filter newly saved references from iOS Shortcut and paste."
      phase="Prompt P6"
      icon={<Inbox className="size-6" />}
    />
  );
}
