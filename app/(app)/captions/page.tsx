import { Quote } from "lucide-react";
import { PlaceholderPage } from "@/components/app/placeholder-page";

export default function CaptionsPage() {
  return (
    <PlaceholderPage
      title="Captions & Hashtags"
      description="Library of reusable caption templates and optimized hashtag sets for Instagram, TikTok, and YouTube."
      phase="Prompt P12"
      icon={<Quote className="size-6" />}
    />
  );
}
