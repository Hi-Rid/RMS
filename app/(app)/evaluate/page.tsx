import { CheckSquare } from "lucide-react";
import { PlaceholderPage } from "@/components/app/placeholder-page";

export default function EvaluatePage() {
  return (
    <PlaceholderPage
      title="Evaluation & Snapshots"
      description="Record performance checkpoints at 24h, 7d, and 30d (views, likes, retention, rating) to measure content success."
      phase="Prompt P10"
      icon={<CheckSquare className="size-6" />}
    />
  );
}
