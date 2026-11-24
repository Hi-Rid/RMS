import { Calendar } from "lucide-react";
import { PlaceholderPage } from "@/components/app/placeholder-page";

export default function PlannerPage() {
  return (
    <PlaceholderPage
      title="Content Planner"
      description="Visual monthly calendar and weekly publishing schedule. Organize planned contents and unscheduled drafts."
      phase="Prompt P12"
      icon={<Calendar className="size-6" />}
    />
  );
}
