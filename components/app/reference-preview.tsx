"use client";

import * as React from "react";
import { useState } from "react";
import {
  ExternalLink,
  Play,
  Camera,
  Video,
  Film,
} from "lucide-react";

interface ReferencePreviewProps {
  url: string;
  platform: string;
  format?: string | null;
  coverUrl?: string | null;
  hookText?: string | null;
  summary?: string | null;
  handle?: string | null;
  className?: string;
}

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
  );
  return match ? match[1] : null;
}

function getPlatformDetails(platformSlug: string) {
  const p = platformSlug.toLowerCase();
  switch (p) {
    case "instagram":
      return {
        name: "Instagram",
        badge: "Reel",
        gradient: "from-pink-600/20 via-purple-600/15 to-orange-500/20",
        border: "border-pink-500/30",
        accent: "text-pink-600 dark:text-pink-400",
        pillBg: "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/30",
        icon: Camera,
      };
    case "tiktok":
      return {
        name: "TikTok",
        badge: "TikTok",
        gradient: "from-cyan-500/20 via-neutral-900/40 to-pink-500/20",
        border: "border-cyan-500/30",
        accent: "text-cyan-600 dark:text-cyan-400",
        pillBg: "bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 border-cyan-500/30",
        icon: Video,
      };
    case "youtube":
      return {
        name: "YouTube",
        badge: "Shorts",
        gradient: "from-red-600/20 via-neutral-900/40 to-red-800/20",
        border: "border-red-500/30",
        accent: "text-red-600 dark:text-red-400",
        pillBg: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
        icon: Play,
      };
    case "threads":
      return {
        name: "Threads",
        badge: "Thread",
        gradient: "from-neutral-700/20 via-neutral-800/30 to-neutral-900/20",
        border: "border-neutral-500/30",
        accent: "text-foreground",
        pillBg: "bg-foreground text-background border-foreground",
        icon: Film,
      };
    default:
      return {
        name: "Reference",
        badge: "Media",
        gradient: "from-secondary via-background to-secondary/80",
        border: "border-border",
        accent: "text-muted-foreground",
        pillBg: "bg-secondary text-secondary-foreground border-border",
        icon: Film,
      };
  }
}

export function ReferencePreview({
  url,
  platform,
  format,
  coverUrl,
  hookText,
  summary,
  handle,
  className = "",
}: ReferencePreviewProps) {
  const [imageError, setImageError] = useState(false);
  const details = getPlatformDetails(platform);
  const youtubeId = extractYouTubeId(url);
  const PlatformIcon = details.icon;

  // Resolve active image thumbnail
  const activeThumbnail =
    coverUrl && !imageError
      ? coverUrl
      : youtubeId && !imageError
      ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
      : null;

  return (
    <div
      className={`relative w-full aspect-[16/9] sm:aspect-[16/10] rounded-md overflow-hidden bg-secondary/80 border ${details.border} group/preview ${className}`}
    >
      {activeThumbnail ? (
        <>
          {/* Real Thumbnail Image */}
          <img
            src={activeThumbnail}
            alt={hookText || summary || "Reference Preview"}
            loading="lazy"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover/preview:scale-[1.03]"
          />
          {/* Subtle dark gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        </>
      ) : (
        /* Stylized Media Poster Substrate (PRD §12.0) */
        <div
          className={`w-full h-full p-3.5 flex flex-col justify-between bg-gradient-to-br ${details.gradient} relative select-none`}
        >
          {/* Subtle blueprint grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.07] pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
              backgroundSize: "16px 16px",
            }}
          />

          {/* Top Row: Platform Badge & Format */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${details.pillBg} flex items-center gap-1 shadow-none`}
              >
                <PlatformIcon className="size-3" />
                <span>{details.name}</span>
              </span>
              {format && (
                <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-background/80 text-foreground/80 border border-border/80">
                  {format}
                </span>
              )}
            </div>
          </div>

          {/* Center: Play watermark or quotation teaser */}
          <div className="relative z-10 my-auto py-1">
            {hookText ? (
              <p className="text-xs font-mono font-bold text-foreground line-clamp-2 leading-snug drop-shadow-sm">
                &ldquo;{hookText}&rdquo;
              </p>
            ) : summary ? (
              <p className="text-xs font-mono text-foreground/90 line-clamp-2 leading-relaxed">
                {summary}
              </p>
            ) : (
              <div className="flex items-center justify-center">
                <div className="size-10 rounded-full bg-background/80 border border-border/80 flex items-center justify-center text-foreground group-hover/preview:scale-110 transition-transform">
                  <Play className="size-4 ml-0.5 fill-current text-foreground" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Persistent Bottom Bar on Preview */}
      <div className="absolute inset-x-0 bottom-0 p-2.5 z-20 flex items-center justify-between pointer-events-none text-white drop-shadow-sm">
        <div className="flex items-center gap-1.5">
          {handle && (
            <span className="text-[11px] font-mono font-bold bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-xs text-white/90">
              @{handle}
            </span>
          )}
        </div>

        {/* Center/Right Play Watermark Indicator */}
        <div className="flex items-center gap-1 text-[10px] font-mono uppercase font-bold bg-black/60 px-2 py-0.5 rounded backdrop-blur-xs text-white/90">
          <Play className="size-2.5 fill-current" />
          <span>{details.badge}</span>
        </div>
      </div>

      {/* Hover Quick Action: External Link */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title="Open original video"
        onClick={(e) => e.stopPropagation()}
        className="absolute top-2 right-2 z-30 size-7 rounded-md bg-black/70 hover:bg-black text-white flex items-center justify-center transition-all opacity-90 hover:opacity-100 shadow-sm"
      >
        <ExternalLink className="size-3.5" />
      </a>
    </div>
  );
}
