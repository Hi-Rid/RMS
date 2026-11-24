/**
 * RMS URL Normalization & Extraction (PRD §10.1)
 */

import { AppError } from "@/lib/errors";
import { normalizeHandle } from "@/lib/domain/normalize";

export type Platform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "facebook"
  | "threads"
  | "other";

export type ContentFormatGuess = "reel" | "carousel" | "story" | undefined;

export interface NormalizedUrl {
  url: string;
  platform: Platform;
  externalId?: string;
  format?: ContentFormatGuess;
  handle?: string;
}

const TRACKING_PARAM_REGEX = /^(utm_.*|share_.*|igsh|igshid|fbclid|gclid|ttclid|si|feature|ref|is_from_webapp|sender_device|sender_web_id|_t|_r|xmt)$/i;

/**
 * Extracts all URLs from raw text/HTML/JSON in order.
 */
export function extractUrls(text: string): string[] {
  if (!text) return [];
  // Decode escaped slashes and html entities
  const decoded = text.replace(/\\\//g, "/").replace(/&amp;/g, "&");

  const urlRegex = /https?:\/\/[^\s<>"')]+/gi;
  const matches: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(decoded)) !== null) {
    let clean = match[0].replace(/[.,;)]+$/, "");
    if (clean) {
      matches.push(clean);
    }
  }

  return matches;
}

/**
 * Resolves short links (up to 3 hops) with a 4s timeout per hop.
 */
async function resolveShortLink(
  initialUrl: string,
  maxHops = 3
): Promise<string> {
  let currentUrl = initialUrl;
  let hops = 0;

  while (hops < maxHops) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(currentUrl, {
        method: "HEAD",
        redirect: "manual",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const location = res.headers.get("location");
      if ([301, 302, 303, 307, 308].includes(res.status) && location) {
        const nextUrl = new URL(location, currentUrl).href;
        currentUrl = nextUrl;
        hops++;
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  return currentUrl;
}

/**
 * Normalizes an input string containing a URL according to PRD §10.1.
 */
export async function normalizeUrl(
  input: string,
  options?: { resolveShortLinks?: boolean }
): Promise<NormalizedUrl> {
  if (!input || typeof input !== "string") {
    throw new AppError("invalid_url", "Input URL cannot be empty");
  }

  let text = input.trim().replace(/\\\//g, "/").replace(/&amp;/g, "&");

  // Extract URL from text or handle bare host.tld/path
  let rawUrl = "";
  const extracted = extractUrls(text);
  if (extracted.length > 0) {
    rawUrl = extracted[0];
  } else if (/^[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+\/[^\s]+$/.test(text)) {
    rawUrl = `https://${text}`;
  } else {
    throw new AppError("invalid_url", "No valid URL found in input");
  }

  // Parse URL
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new AppError("invalid_url", "Invalid URL format");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AppError("invalid_url", "Protocol must be http or https");
  }

  // Force https, host lowercase, strip www, m, mobile, strip fragment
  parsed.protocol = "https:";
  let host = parsed.hostname.toLowerCase();
  host = host.replace(/^(www\.|m\.|mobile\.)/, "");
  parsed.hash = "";

  // Identify platform
  let platform: Platform = "other";
  if (host === "instagram.com") platform = "instagram";
  else if (
    host === "tiktok.com" ||
    host === "vm.tiktok.com" ||
    host === "vt.tiktok.com"
  )
    platform = "tiktok";
  else if (host === "youtube.com" || host === "youtu.be") platform = "youtube";
  else if (host === "facebook.com" || host === "fb.watch") platform = "facebook";
  else if (host === "threads.net") platform = "threads";

  // Check for short links that need network resolution
  const isShortLink =
    host === "vm.tiktok.com" ||
    host === "vt.tiktok.com" ||
    (host === "tiktok.com" && parsed.pathname.startsWith("/t/")) ||
    host === "fb.watch" ||
    (host === "facebook.com" &&
      (parsed.pathname.startsWith("/share/r/") ||
        parsed.pathname.startsWith("/share/v/")));

  if (isShortLink && options?.resolveShortLinks !== false) {
    const resolved = await resolveShortLink(parsed.href, 3);
    if (resolved !== parsed.href) {
      // Re-run normalization on resolved destination
      return normalizeUrl(resolved, { resolveShortLinks: false });
    } else {
      // Resolve failed: canonical is https://host/path without trailing slash and no query
      const cleanPath = parsed.pathname.replace(/\/+$/, "");
      return {
        url: `https://${host}${cleanPath}`,
        platform,
      };
    }
  }

  // Platform canonicalization & extraction
  const path = parsed.pathname;

  if (platform === "instagram") {
    // /reel/{kode}, /reels/{kode}, /{user}/reel/{kode}
    const reelMatch = path.match(/^(?:\/([^/]+))?\/reels?\/([a-zA-Z0-9_-]+)/);
    if (reelMatch) {
      const possibleUser = reelMatch[1];
      const code = reelMatch[2];
      const handle =
        possibleUser && !possibleUser.startsWith("reel")
          ? normalizeHandle(possibleUser)
          : undefined;

      return {
        url: `https://www.instagram.com/reel/${code}/`,
        platform: "instagram",
        externalId: code,
        format: "reel",
        handle,
      };
    }

    // /p/{kode}, /tv/{kode}, /{user}/p/{kode}
    const postMatch = path.match(/^(?:\/([^/]+))?\/(?:p|tv)\/([a-zA-Z0-9_-]+)/);
    if (postMatch) {
      const possibleUser = postMatch[1];
      const code = postMatch[2];
      const handle =
        possibleUser && !["p", "tv"].includes(possibleUser)
          ? normalizeHandle(possibleUser)
          : undefined;

      return {
        url: `https://www.instagram.com/p/${code}/`,
        platform: "instagram",
        externalId: code,
        format: undefined,
        handle,
      };
    }

    // /stories/{user}/{id}
    const storyMatch = path.match(/^\/stories\/([^/]+)\/([0-9]+)/);
    if (storyMatch) {
      const user = storyMatch[1];
      const id = storyMatch[2];
      return {
        url: `https://www.instagram.com/stories/${user}/${id}/`,
        platform: "instagram",
        externalId: `story:${id}`,
        format: "story",
        handle: normalizeHandle(user),
      };
    }

    return {
      url: `https://www.instagram.com${path.replace(/\/+$/, "")}/`,
      platform: "instagram",
    };
  }

  if (platform === "tiktok") {
    // /@{user}/video/{id}
    const videoMatch = path.match(/^\/@([^/]+)\/video\/([0-9]+)/);
    if (videoMatch) {
      const user = videoMatch[1];
      const id = videoMatch[2];
      return {
        url: `https://www.tiktok.com/@${user}/video/${id}`,
        platform: "tiktok",
        externalId: id,
        format: "reel",
        handle: normalizeHandle(user),
      };
    }

    // /@{user}/photo/{id}
    const photoMatch = path.match(/^\/@([^/]+)\/photo\/([0-9]+)/);
    if (photoMatch) {
      const user = photoMatch[1];
      const id = photoMatch[2];
      return {
        url: `https://www.tiktok.com/@${user}/photo/${id}`,
        platform: "tiktok",
        externalId: id,
        format: "carousel",
        handle: normalizeHandle(user),
      };
    }

    return {
      url: `https://www.tiktok.com${path.replace(/\/+$/, "")}`,
      platform: "tiktok",
    };
  }

  if (platform === "youtube") {
    // youtu.be/{id}
    if (host === "youtu.be") {
      const id = path.replace(/^\/+/, "").split("/")[0];
      if (id) {
        return {
          url: `https://www.youtube.com/watch?v=${id}`,
          platform: "youtube",
          externalId: id,
          format: "reel",
        };
      }
    }

    // /shorts/{id}
    const shortsMatch = path.match(/^\/shorts\/([a-zA-Z0-9_-]+)/);
    if (shortsMatch) {
      const id = shortsMatch[1];
      return {
        url: `https://www.youtube.com/shorts/${id}`,
        platform: "youtube",
        externalId: id,
        format: "reel",
      };
    }

    // /watch?v={id}
    if (path.startsWith("/watch")) {
      const v = parsed.searchParams.get("v");
      if (v) {
        return {
          url: `https://www.youtube.com/watch?v=${v}`,
          platform: "youtube",
          externalId: v,
          format: "reel",
        };
      }
    }

    return {
      url: `https://www.youtube.com${path.replace(/\/+$/, "")}`,
      platform: "youtube",
    };
  }

  if (platform === "facebook") {
    // /reel/{id}
    const reelMatch = path.match(/^\/reel\/([a-zA-Z0-9_-]+)/);
    if (reelMatch) {
      const id = reelMatch[1];
      return {
        url: `https://www.facebook.com/reel/${id}`,
        platform: "facebook",
        externalId: id,
        format: "reel",
      };
    }

    // /watch/?v={id}
    if (path.startsWith("/watch")) {
      const v = parsed.searchParams.get("v");
      if (v) {
        return {
          url: `https://www.facebook.com/reel/${v}`,
          platform: "facebook",
          externalId: v,
          format: "reel",
        };
      }
    }

    return {
      url: `https://www.facebook.com${path.replace(/\/+$/, "")}`,
      platform: "facebook",
    };
  }

  if (platform === "threads") {
    // /@{user}/post/{kode}
    const threadMatch = path.match(/^\/@([^/]+)\/post\/([a-zA-Z0-9_-]+)/);
    if (threadMatch) {
      const user = threadMatch[1];
      const code = threadMatch[2];
      return {
        url: `https://www.threads.net/@${user}/post/${code}`,
        platform: "threads",
        externalId: code,
        format: undefined,
        handle: normalizeHandle(user),
      };
    }

    return {
      url: `https://www.threads.net${path.replace(/\/+$/, "")}`,
      platform: "threads",
    };
  }

  // Other platform
  // Strip tracking parameters
  const cleanParams = new URLSearchParams();
  parsed.searchParams.forEach((val, key) => {
    if (!TRACKING_PARAM_REGEX.test(key)) {
      cleanParams.set(key, val);
    }
  });

  const queryString = cleanParams.toString() ? `?${cleanParams.toString()}` : "";
  let cleanPath = path.replace(/\/+$/, "");

  return {
    url: `https://${host}${cleanPath}${queryString}`,
    platform: "other",
  };
}
