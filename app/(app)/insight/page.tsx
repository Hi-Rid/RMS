import { LineChart } from "lucide-react";
import { PlaceholderPage } from "@/components/app/placeholder-page";

export default function InsightPage() {
  return (
    <PlaceholderPage
      title="Insight & Analytics"
      description="Data-driven ranking of your best sources, pillars, formats, hooks, and audio with sample size verification."
      phase="Prompt P17"
      icon={<LineChart className="size-6" />}
    />
  );
}
