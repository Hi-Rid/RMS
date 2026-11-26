"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Play,
  Camera,
  Video,
  Film,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ReferencePreviewProps {
  url: string;
  platform: string;
  format?: string | null;
  coverUrl?: string | null;
  hookText?: string | null;
  summary?: string | null;
  handle?: string | null;
  detailHref?: string;
  detailAriaLabel?: string;
  className?: string;
  showExternalButton?: boolean;
}

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
  );
  return match ? match[1] : null;
}

function extractTikTokId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/tiktok\.com\/(?:[^/]+\/video\/|v\/)(\d+)/i);
  return match ? match[1] : null;
}

function extractInstagramEmbedUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(
    /instagram\.com\/(?:[^/]+\/)?(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i
  );
  if (!match) return null;
  const rawKind = match[1].toLowerCase();
  const kind = rawKind === "reels" ? "reel" : rawKind;
  return `https://www.instagram.com/${kind}/${match[2]}/embed`;
}

function resolveInlineEmbedUrl(url: string, platformSlug: string): string | null {
  const yt = extractYouTubeId(url);
  if (yt) {
    return `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`;
  }

  const slug = platformSlug.toLowerCase();
  if (slug === "tiktok" || url.toLowerCase().includes("tiktok.com")) {
    const tt = extractTikTokId(url);
    if (tt) return `https://www.tiktok.com/embed/v2/${tt}`;
  }

  if (slug === "instagram" || url.toLowerCase().includes("instagram.com")) {
    const ig = extractInstagramEmbedUrl(url);
    if (ig) return ig;
  }

  return null;
}

function getPlatformDetails(platformSlug: string) {
  const p = platformSlug.toLowerCase();
  switch (p) {
    case "instagram":
      return {
        name: "Instagram",
        badge: "Instagram",
        gradient: "from-brand/10 via-secondary to-secondary/70",
        border: "border-border",
        pillBg: "bg-card text-foreground border-border",
        icon: Camera,
      };
    case "tiktok":
      return {
        name: "TikTok",
        badge: "TikTok",
        gradient: "from-foreground/10 via-secondary to-secondary/80",
        border: "border-border",
        pillBg: "bg-card text-foreground border-border",
        icon: Video,
      };
    case "youtube":
      return {
        name: "YouTube",
        badge: "YouTube",
        gradient: "from-brand/10 via-secondary to-muted",
        border: "border-border",
        pillBg: "bg-card text-foreground border-border",
        icon: Play,
      };
    case "threads":
      return {
        name: "Threads",
        badge: "Thread",
        gradient: "from-foreground/10 via-secondary to-muted",
        border: "border-border",
        pillBg: "bg-foreground text-background border-foreground",
        icon: Film,
      };
    default:
      return {
        name: "Reference",
        badge: "Media",
        gradient: "from-secondary via-background to-secondary/80",
        border: "border-border",
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
  detailHref,
  detailAriaLabel,
  className = "",
  showExternalButton = true,
}: ReferencePreviewProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [playingInline, setPlayingInline] = useState(false);

  // Reset media states whenever preview target changes (critical in TriageFlow)
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
    setPlayingInline(false);
  }, [url, coverUrl]);

  const details = getPlatformDetails(platform);
  const youtubeId = extractYouTubeId(url);
  const embedUrl = resolveInlineEmbedUrl(url, platform);
  const PlatformIcon = details.icon;

  const isVertical =
    format?.toLowerCase().includes("reel") ||
    format?.toLowerCase().includes("short") ||
    format?.toLowerCase().includes("story") ||
    platform?.toLowerCase() === "instagram" ||
    platform?.toLowerCase() === "tiktok";

  const directEmbedUrl = url
    ? `https://api.microlink.io/?url=${encodeURIComponent(url)}&embed=image.url`
    : null;

  const activeThumbnail =
    coverUrl && !imageError
      ? coverUrl
      : youtubeId && !imageError
        ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
        : directEmbedUrl && !imageError
          ? directEmbedUrl
          : null;

  const defaultAspect = isVertical ? "aspect-[4/5]" : "aspect-[16/10]";

  return (
    <div
      className={cn(
        "relative w-full rounded-md overflow-hidden bg-secondary/80 border group/preview",
        details.border,
        defaultAspect,
        className
      )}
    >
      {playingInline && embedUrl ? (
        <div className="relative w-full h-full bg-black">
          <iframe
            src={embedUrl}
            title={hookText || summary || "Embedded video player"}
            className="w-full h-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
          />
          <div className="absolute top-2.5 right-2.5 z-40 flex items-center gap-1.5">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open original if embed is blocked"
              aria-label="Open original post in new tab"
              onClick={(e) => e.stopPropagation()}
              className="size-8 rounded-md bg-black/80 hover:bg-black text-white flex items-center justify-center border border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <ExternalLink className="size-3.5" />
            </a>
            <button
              type="button"
              title="Close inline player"
              aria-label="Close inline player"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPlayingInline(false);
              }}
              className="size-8 rounded-md bg-black/80 hover:bg-black text-white flex items-center justify-center border border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {activeThumbnail ? (
            <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-black/95">
              {/* Loading Shimmer before image arrives */}
              {!imageLoaded && (
                <div className="absolute inset-0 bg-muted/40 animate-pulse" />
              )}

              {/* Ambient Blurred Background */}
              <img
                src={activeThumbnail}
                alt=""
                aria-hidden="true"
                onError={() => setImageError(true)}
                className="absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-40 brightness-75 select-none pointer-events-none"
              />
              <div className="absolute inset-0 bg-black/30 backdrop-blur-md pointer-events-none" />

              {/* Foreground Thumbnail without distorting landscape aspect */}
              <div className="relative z-10 h-full w-full flex items-center justify-center">
                <img
                  src={activeThumbnail}
                  alt={hookText || summary || "Reference Preview"}
                  loading="lazy"
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                  className={cn(
                    "max-h-full max-w-full object-contain select-none transition-transform duration-300 group-hover/preview:scale-[1.02]",
                    isVertical ? "h-full w-auto" : "w-full h-full"
                  )}
                />
              </div>

              {/* Center Play Button (ONLY rendered when embedUrl is actually playable; sits above detailHref Link overlay) */}
              {embedUrl && (
                <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
                  <button
                    type="button"
                    aria-label="Play video inline"
                    title="Play video inline"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPlayingInline(true);
                    }}
                    className="pointer-events-auto size-11 rounded-md bg-black/70 hover:bg-black/90 border border-white/25 backdrop-blur-sm flex items-center justify-center text-white transition-transform duration-150 hover:scale-105 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                  >
                    <Play className="size-5 ml-0.5 fill-current text-white" />
                  </button>
                </div>
              )}

              {/* Vignette gradient overlay */}
              <div className="absolute inset-0 z-15 pointer-events-none bg-gradient-to-t from-black/75 via-transparent to-black/30" />
            </div>
          ) : (
            /* Stylized Media Poster Substrate */
            <div
              className={`w-full h-full p-3.5 flex flex-col justify-between bg-gradient-to-br ${details.gradient} relative select-none`}
            >
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-[0.07] pointer-events-none"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
                  backgroundSize: "16px 16px",
                }}
              />

              <div className="relative z-10 flex items-center justify-between gap-2 pr-8 pointer-events-none">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border ${details.pillBg} flex items-center gap-1`}
                  >
                    <PlatformIcon className="size-3" />
                    <span>{details.name}</span>
                  </span>
                  {format && (
                    <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-background/85 text-foreground/85 border border-border/80">
                      {format}
                    </span>
                  )}
                </div>
              </div>

              <div className="relative z-30 my-auto py-1 pointer-events-none">
                {hookText ? (
                  <p className="text-xs font-mono font-bold text-foreground line-clamp-3 leading-snug">
                    &ldquo;{hookText}&rdquo;
                  </p>
                ) : summary ? (
                  <p className="text-xs font-mono text-foreground/90 line-clamp-3 leading-relaxed">
                    {summary}
                  </p>
                ) : embedUrl ? (
                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      aria-label="Play video inline"
                      title="Play video inline"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPlayingInline(true);
                      }}
                      className="pointer-events-auto size-10 rounded-md bg-background/90 hover:bg-background border border-border flex items-center justify-center text-foreground hover:scale-105 transition-transform cursor-pointer"
                    >
                      <Play className="size-4 ml-0.5 fill-current text-foreground" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center text-muted-foreground">
                    <PlatformIcon className="size-7 opacity-40" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sibling Detail Navigation Overlay (renders at z-20 under interactive controls at z-30 to avoid nested anchors) */}
          {detailHref && (
            <Link
              href={detailHref}
              aria-label={detailAriaLabel || "Open reference details"}
              className="absolute inset-0 z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          )}

          {/* Persistent Top Overlay: Platform Badge (when image thumbnail is active) */}
          {activeThumbnail && (
            <div className="absolute top-2 left-2 z-30 flex items-center gap-1 pointer-events-none">
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md border bg-black/75 text-white border-white/20 flex items-center gap-1 backdrop-blur-xs">
                <PlatformIcon className="size-3" />
                <span>{details.name}</span>
              </span>
              {format && (
                <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-black/65 text-white/90 border border-white/20 backdrop-blur-xs">
                  {format}
                </span>
              )}
            </div>
          )}

          {/* Persistent Bottom Bar on Preview */}
          <div className="absolute inset-x-0 bottom-0 p-2.5 z-30 flex items-center justify-between gap-2 pointer-events-none text-white">
            <div className="min-w-0 max-w-[60%]">
              {handle && (
                <span
                  title={`@${handle}`}
                  className="inline-block max-w-full truncate text-[11px] font-mono font-bold bg-black/70 px-1.5 py-0.5 rounded-md backdrop-blur-xs text-white/95 border border-white/10"
                >
                  @{handle}
                </span>
              )}
            </div>

            {embedUrl ? (
              <span className="text-[10px] font-mono uppercase font-bold bg-black/70 px-2 py-0.5 rounded-md backdrop-blur-xs text-white/95 border border-white/10 shrink-0">
                Inline Video
              </span>
            ) : (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="pointer-events-auto flex items-center gap-1 text-[10px] font-mono uppercase font-bold bg-black/75 hover:bg-black px-2 py-0.5 rounded-md backdrop-blur-xs text-white border border-white/20 shrink-0"
              >
                <ExternalLink className="size-2.5" />
                <span>Open</span>
              </a>
            )}
          </div>

          {/* Optional Top-Right External Link */}
          {showExternalButton && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open original post"
              aria-label="Open original post in new tab"
              onClick={(e) => e.stopPropagation()}
              className="absolute top-2 right-2 z-30 size-8 rounded-md bg-black/70 hover:bg-black text-white flex items-center justify-center transition-opacity opacity-90 hover:opacity-100 border border-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </>
      )}
    </div>
  );
}
