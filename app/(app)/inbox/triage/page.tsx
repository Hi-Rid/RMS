import { ListTodo } from "lucide-react";
import { PlaceholderPage } from "@/components/app/placeholder-page";

export default function TriagePage() {
  return (
    <PlaceholderPage
      title="Triage Mode"
      description="Process inbox references one by one with rapid keyboard shortcuts: Select, Skip, or Later."
      phase="Prompt P6"
      icon={<ListTodo className="size-6" />}
      backHref="/inbox"
      backLabel="Back to Inbox"
    />
  );
}
