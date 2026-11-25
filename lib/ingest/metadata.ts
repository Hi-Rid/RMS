import type { Platform } from "@/lib/domain/url";

export interface SocialMetadata {
  url: string;
  platform: Platform;
  title: string | null;
  description: string | null;
  authorName: string | null;
  authorHandle: string | null;
  coverUrl: string | null;
  audioTitle: string | null;
  audioArtist: string | null;
  hashtags: string[];
  sharedText: string | null;
  provider: string;
}

const RESERVED_HANDLES = new Set([
  "p",
  "reel",
  "reels",
  "stories",
  "story",
  "tv",
  "explore",
  "share",
  "accounts",
  "video",
  "videos",
  "watch",
  "shorts",
  "playlist",
  "channel",
  "c",
  "user",
  "i",
  "intent",
  "home",
  "search",
  "hashtag",
  "login",
  "signup",
  "t",
  "v",
  "discover",
  "music",
  "tag",
  "tags",
]);

const GENERIC_WALL_TITLES = new Set([
  "instagram",
  "login • instagram",
  "log in • instagram",
  "threads",
  "log in to facebook",
  "facebook",
  "tiktok",
  "tiktok - make your day",
  "youtube",
  "x",
  "twitter",
  "pinterest",
  "sign in",
  "just a moment...",
  "access denied",
]);

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : _;
    });
}

function cleanText(value: string | null | undefined, maxLength = 600): string | null {
  if (!value) return null;
  const normalized = value.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength).trim();
}

function isInformativeTitle(title: string | null): title is string {
  if (!title) return false;
  const lower = title.toLowerCase().trim();
  if (lower.length < 2) return false;
  return !GENERIC_WALL_TITLES.has(lower);
}

function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^https?:\/\/\S+/i.test(trimmed)) {
    return trimmed.slice(0, 1000);
  }
  return null;
}

export function normalizeSocialHandle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .replace(/^@+/, "")
    .replace(/[/?#].*$/, "")
    .trim()
    .toLowerCase();
  if (!cleaned || cleaned.length > 100) return null;
  if (!/^[a-z0-9._-]+$/.test(cleaned)) return null;
  if (RESERVED_HANDLES.has(cleaned)) return null;
  return cleaned;
}

export function extractSharedText(
  rawInput: string | null | undefined,
  canonicalUrl?: string
): string | null {
  if (!rawInput) return null;
  let stripped = rawInput.replace(/https?:\/\/[^\s<>"{}|\\^`[\]]+/gi, " ");
  if (canonicalUrl) {
    stripped = stripped.split(canonicalUrl).join(" ");
  }
  stripped = stripped
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!stripped || stripped.length < 2) return null;
  return stripped.slice(0, 1500).trim();
}

export function extractHashtagsFromText(
  text: string | null | undefined,
  max = 15
): string[] {
  if (!text) return [];
  const matches = text.matchAll(/(?:^|[\s,;.!?()[\]])#([\p{L}\p{N}_]{2,40})/gu);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const match of matches) {
    const tag = match[1]?.toLowerCase().trim();
    if (!tag || seen.has(tag)) continue;
    if (/^\d+$/.test(tag)) continue;
    seen.add(tag);
    result.push(tag);
    if (result.length >= max) break;
  }
  return result;
}

export function extractHandleFromProfileUrl(
  profileUrl: string | null | undefined,
  platform?: Platform
): string | null {
  if (!profileUrl) return null;
  try {
    const parsed = new URL(profileUrl);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return null;

    const first = segments[0];
    if (first.startsWith("@")) {
      return normalizeSocialHandle(first);
    }

    if (platform === "instagram" || platform === "threads") {
      return normalizeSocialHandle(first);
    }

    if (segments[0] === "channel" || segments[0] === "c" || segments[0] === "user") {
      return segments[1] ? normalizeSocialHandle(segments[1]) : null;
    }

    return null;
  } catch {
    return null;
  }
}

export function extractInstagramOrAuthorFromTitle(
  title: string | null | undefined,
  platform: Platform
): { authorName: string | null; authorHandle: string | null; cleanedTitle: string | null } {
  if (!title) return { authorName: null, authorHandle: null, cleanedTitle: null };

  if (platform === "instagram" || platform === "threads") {
    // Pattern like: `Creator Name (@handle) • Instagram photos and videos`
    // or `handle on Instagram: "caption..."`
    const parenMatch = title.match(/^(.+?)\s*\(@([a-zA-Z0-9._]+)\)/);
    if (parenMatch) {
      const handle = normalizeSocialHandle(parenMatch[2]);
      const name = cleanText(parenMatch[1], 120);
      const quotePart = title.match(/:\s*["""](.+?)["""]\s*$/);
      return {
        authorName: name,
        authorHandle: handle,
        cleanedTitle: cleanText(quotePart?.[1] ?? title, 400),
      };
    }

    const onIgMatch = title.match(/^([a-zA-Z0-9._\s]+?)\s+on\s+(?:Instagram|Threads):\s*(.+)$/i);
    if (onIgMatch) {
      const candidate = onIgMatch[1].trim();
      const maybeHandle = /^[a-zA-Z0-9._]+$/.test(candidate)
        ? normalizeSocialHandle(candidate)
        : null;
      return {
        authorName: cleanText(candidate, 120),
        authorHandle: maybeHandle,
        cleanedTitle: cleanText(onIgMatch[2].replace(/^[""]|[""]$/g, ""), 400),
      };
    }
  }

  return { authorName: null, authorHandle: null, cleanedTitle: title };
}

export function parseAudioFromText(text: string | null | undefined): {
  audioTitle: string | null;
  audioArtist: string | null;
} {
  if (!text) return { audioTitle: null, audioArtist: null };

  // TikTok / Reels explicit notation like: `♬ original sound - CreatorName` or `♫ Song - Artist`
  const symbolMatch = text.match(/[♬♫♪]\s*([^\n|]{2,160})/);
  const candidate = symbolMatch?.[1]?.trim();
  if (candidate) {
    const splitDash = candidate.split(/\s+-\s+/);
    if (splitDash.length >= 2) {
      return {
        audioTitle: cleanText(splitDash[0], 200),
        audioArtist: cleanText(splitDash.slice(1).join(" - "), 200),
      };
    }
    return {
      audioTitle: cleanText(candidate, 200),
      audioArtist: null,
    };
  }

  const origMatch = text.match(
    /\b(original sound|suara asli)\s*-\s*([^\n#@|]{2,100})/i
  );
  if (origMatch) {
    return {
      audioTitle: cleanText(`${origMatch[1]} - ${origMatch[2]}`, 200),
      audioArtist: cleanText(origMatch[2], 200),
    };
  }

  return { audioTitle: null, audioArtist: null };
}

export function parseOpenGraphMeta(html: string): {
  title: string | null;
  description: string | null;
  image: string | null;
  author: string | null;
} {
  const metaMap = new Map<string, string>();
  const metaRegex = /<meta\s+([^>]*?)\/?>/gi;
  let match: RegExpExecArray | null;

  while ((match = metaRegex.exec(html)) !== null) {
    const attrs = match[1];
    const keyMatch = attrs.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i);
    const valMatch = attrs.match(/content\s*=\s*["']([^"']*)["']/i);
    if (!keyMatch || !valMatch) continue;
    const key = keyMatch[1].toLowerCase().trim();
    const val = decodeHtmlEntities(valMatch[1]).trim();
    if (key && val && !metaMap.has(key)) {
      metaMap.set(key, val);
    }
  }

  let docTitle: string | null = null;
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    docTitle = decodeHtmlEntities(titleMatch[1]).trim();
  }

  const rawTitle =
    metaMap.get("og:title") ?? metaMap.get("twitter:title") ?? docTitle ?? null;
  const rawDescription =
    metaMap.get("og:description") ??
    metaMap.get("twitter:description") ??
    metaMap.get("description") ??
    null;
  const rawImage =
    metaMap.get("og:image") ??
    metaMap.get("og:image:secure_url") ??
    metaMap.get("twitter:image") ??
    null;
  const rawAuthor =
    metaMap.get("author") ??
    metaMap.get("twitter:creator") ??
    metaMap.get("og:site_name") ??
    null;

  return {
    title: cleanText(rawTitle, 400),
    description: cleanText(rawDescription, 1000),
    image: safeHttpUrl(rawImage),
    author: cleanText(rawAuthor, 120),
  };
}

interface OEmbedResult {
  title: string | null;
  authorName: string | null;
  authorUrl: string | null;
  thumbnailUrl: string | null;
  provider: string;
}

async function fetchTikTokOembed(url: string): Promise<OEmbedResult | null> {
  try {
    const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    const res = await fetch(endpoint, {
      signal: AbortSignal.timeout(3500),
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      author_url?: string;
      thumbnail_url?: string;
    };
    return {
      title: cleanText(data.title, 500),
      authorName: cleanText(data.author_name, 120),
      authorUrl: safeHttpUrl(data.author_url),
      thumbnailUrl: safeHttpUrl(data.thumbnail_url),
      provider: "tiktok-oembed",
    };
  } catch {
    return null;
  }
}

async function fetchYouTubeOembed(url: string): Promise<OEmbedResult | null> {
  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(endpoint, {
      signal: AbortSignal.timeout(3500),
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      author_url?: string;
      thumbnail_url?: string;
    };
    return {
      title: cleanText(data.title, 400),
      authorName: cleanText(data.author_name, 120),
      authorUrl: safeHttpUrl(data.author_url),
      thumbnailUrl: safeHttpUrl(data.thumbnail_url),
      provider: "youtube-oembed",
    };
  } catch {
    return null;
  }
}

async function fetchMicrolink(url: string): Promise<{
  title: string | null;
  description: string | null;
  authorName: string | null;
  image: string | null;
  provider: string;
} | null> {
  try {
    const endpoint = `https://api.microlink.io/?url=${encodeURIComponent(url)}`;
    const res = await fetch(endpoint, {
      signal: AbortSignal.timeout(3800),
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      status?: string;
      data?: {
        title?: string | null;
        description?: string | null;
        author?: string | null;
        image?: { url?: string | null } | null;
      };
    };
    if (json.status !== "success" || !json.data) return null;
    const title = cleanText(json.data.title, 400);
    const description = cleanText(json.data.description, 1000);
    const image = safeHttpUrl(json.data.image?.url);
    const authorName = cleanText(json.data.author, 120);
    if (!isInformativeTitle(title) && !description && !image) return null;
    return {
      title: isInformativeTitle(title) ? title : null,
      description,
      authorName,
      image,
      provider: "microlink",
    };
  } catch {
    return null;
  }
}

async function fetchOpenGraphHtml(url: string): Promise<{
  title: string | null;
  description: string | null;
  authorName: string | null;
  image: string | null;
  provider: string;
} | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(3500),
      cache: "no-store",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
      },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("xhtml")) {
      return null;
    }
    const html = (await res.text()).slice(0, 160_000);
    const og = parseOpenGraphMeta(html);
    const informativeTitle = isInformativeTitle(og.title) ? og.title : null;
    if (!informativeTitle && !og.description && !og.image) return null;
    return {
      title: informativeTitle,
      description: og.description,
      authorName: og.author,
      image: og.image,
      provider: "opengraph",
    };
  } catch {
    return null;
  }
}

export async function fetchSocialMetadata(input: {
  url: string;
  platform: Platform;
  rawInputText?: string | null;
  urlHandle?: string | null;
  externalId?: string | null;
}): Promise<SocialMetadata> {
  const sharedText = extractSharedText(input.rawInputText, input.url);
  let title: string | null = null;
  let description: string | null = null;
  let authorName: string | null = null;
  let authorHandle: string | null = normalizeSocialHandle(input.urlHandle);
  let coverUrl: string | null = null;
  let provider = sharedText ? "share-text" : "none";

  if (input.platform === "tiktok") {
    const oembed = await fetchTikTokOembed(input.url);
    if (oembed) {
      title = isInformativeTitle(oembed.title) ? oembed.title : null;
      authorName = oembed.authorName;
      authorHandle =
        authorHandle ?? extractHandleFromProfileUrl(oembed.authorUrl, "tiktok");
      coverUrl = oembed.thumbnailUrl;
      provider = oembed.provider;
    }
    if (!title && !coverUrl) {
      const [og, micro] = await Promise.all([
        fetchOpenGraphHtml(input.url),
        fetchMicrolink(input.url),
      ]);
      const best = og ?? micro;
      if (best) {
        title = title ?? best.title;
        description = description ?? best.description;
        authorName = authorName ?? best.authorName;
        coverUrl = coverUrl ?? best.image;
        provider = best.provider;
      }
    }
  } else if (input.platform === "youtube") {
    const oembed = await fetchYouTubeOembed(input.url);
    if (oembed) {
      title = isInformativeTitle(oembed.title) ? oembed.title : null;
      authorName = oembed.authorName;
      authorHandle =
        authorHandle ?? extractHandleFromProfileUrl(oembed.authorUrl, "youtube");
      coverUrl = oembed.thumbnailUrl;
      provider = oembed.provider;
    }
    if (!coverUrl && input.externalId) {
      coverUrl = `https://i.ytimg.com/vi/${input.externalId}/hqdefault.jpg`;
    }
  } else {
    const [og, micro] = await Promise.all([
      fetchOpenGraphHtml(input.url),
      fetchMicrolink(input.url),
    ]);
    title = og?.title ?? micro?.title ?? null;
    description = og?.description ?? micro?.description ?? null;
    authorName = og?.authorName ?? micro?.authorName ?? null;
    coverUrl = og?.image ?? micro?.image ?? null;
    provider = og?.provider ?? micro?.provider ?? provider;
  }

  const parsedTitleInfo = extractInstagramOrAuthorFromTitle(title, input.platform);
  if (parsedTitleInfo.authorName && !authorName) {
    authorName = parsedTitleInfo.authorName;
  }
  if (parsedTitleInfo.authorHandle && !authorHandle) {
    authorHandle = parsedTitleInfo.authorHandle;
  }
  if (parsedTitleInfo.cleanedTitle) {
    title = parsedTitleInfo.cleanedTitle;
  }

  const combinedText = [title, description, sharedText].filter(Boolean).join("\n");
  const hashtags = extractHashtagsFromText(combinedText);
  const { audioTitle, audioArtist } = parseAudioFromText(combinedText);

  return {
    url: input.url,
    platform: input.platform,
    title,
    description,
    authorName,
    authorHandle,
    coverUrl,
    audioTitle,
    audioArtist,
    hashtags,
    sharedText,
    provider,
  };
}
