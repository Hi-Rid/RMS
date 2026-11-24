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

  const isVertical =
    format?.toLowerCase().includes("reel") ||
    format?.toLowerCase().includes("short") ||
    format?.toLowerCase().includes("story") ||
    platform?.toLowerCase() === "instagram" ||
    platform?.toLowerCase() === "tiktok";

  // Direct media thumbnail from Microlink for Instagram, TikTok, Threads, X, Facebook
  const directEmbedUrl = url
    ? `https://api.microlink.io/?url=${encodeURIComponent(url)}&embed=image.url`
    : null;

  // Resolve active image thumbnail
  const activeThumbnail =
    coverUrl && !imageError
      ? coverUrl
      : youtubeId && !imageError
      ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
      : directEmbedUrl && !imageError
      ? directEmbedUrl
      : null;

  // Default container aspect ratio: aspect-[4/5] for reels/shorts/vertical, or custom className
  const containerAspect = className || (isVertical ? "aspect-[4/5]" : "aspect-[16/10]");

  return (
    <div
      className={`relative w-full ${containerAspect} rounded-md overflow-hidden bg-secondary/80 border ${details.border} group/preview`}
    >
      {activeThumbnail ? (
        <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-black/95">
          {/* Ambient Blurred Background (Fills left and right empty spaces with matching video blur) */}
          <img
            src={activeThumbnail}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-40 brightness-75 select-none pointer-events-none"
          />
          <div className="absolute inset-0 bg-black/30 backdrop-blur-md pointer-events-none" />

          {/* Uncropped 9:16 Video Thumbnail in Center */}
          <div className="relative z-10 h-full w-full flex items-center justify-center p-0">
            <img
              src={activeThumbnail}
              alt={hookText || summary || "Reference Preview"}
              loading="lazy"
              onError={() => setImageError(true)}
              className="h-full w-auto max-w-full object-contain aspect-[9/16] shadow-2xl select-none transition-transform duration-300 group-hover/preview:scale-[1.02]"
            />
          </div>

          {/* Center Play Button Watermark */}
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="size-11 rounded-full bg-black/55 border border-white/20 backdrop-blur-sm flex items-center justify-center text-white shadow-xl transition-transform duration-200 group-hover/preview:scale-110">
              <Play className="size-5 ml-0.5 fill-current text-white" />
            </div>
          </div>

          {/* Vignette gradient overlay */}
          <div className="absolute inset-0 z-15 pointer-events-none bg-gradient-to-t from-black/70 via-transparent to-black/30" />
        </div>
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

      {/* Persistent Top Overlay: Platform Badge (when image thumbnail is active) */}
      {activeThumbnail && (
        <div className="absolute top-2.5 left-2.5 z-30 flex items-center gap-1.5 pointer-events-none">
          <span
            className={`text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${details.pillBg} flex items-center gap-1 shadow-xs backdrop-blur-xs`}
          >
            <PlatformIcon className="size-3" />
            <span>{details.name}</span>
          </span>
          {format && (
            <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/60 text-white/90 border border-white/20 backdrop-blur-xs">
              {format}
            </span>
          )}
        </div>
      )}

      {/* Persistent Bottom Bar on Preview */}
      <div className="absolute inset-x-0 bottom-0 p-2.5 z-30 flex items-center justify-between pointer-events-none text-white drop-shadow-sm">
        <div className="flex items-center gap-1.5">
          {handle && (
            <span className="text-[11px] font-mono font-bold bg-black/70 px-1.5 py-0.5 rounded backdrop-blur-xs text-white/95 border border-white/10">
              @{handle}
            </span>
          )}
        </div>

        {/* Center/Right Play Watermark Indicator */}
        <div className="flex items-center gap-1 text-[10px] font-mono uppercase font-bold bg-black/70 px-2 py-0.5 rounded backdrop-blur-xs text-white/95 border border-white/10">
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
        className="absolute top-2.5 right-2.5 z-30 size-7 rounded-md bg-black/70 hover:bg-black text-white flex items-center justify-center transition-all opacity-90 hover:opacity-100 shadow-sm border border-white/10"
      >
        <ExternalLink className="size-3.5" />
      </a>
    </div>
  );
}
