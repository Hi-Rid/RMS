import { createClient } from "@supabase/supabase-js";

const BUCKET_NAME = "rms-thumbnails";
const MAX_BYTES = 5 * 1024 * 1024;
let bucketEnsured = false;

function getAdminStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey || serviceKey.includes("your-")) {
    return null;
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function extensionFromMime(mime: string): string {
  const lower = mime.toLowerCase();
  if (lower.includes("png")) return "png";
  if (lower.includes("webp")) return "webp";
  if (lower.includes("avif")) return "avif";
  if (lower.includes("gif")) return "gif";
  return "jpg";
}

export interface MirroredThumbnailResult {
  publicUrl: string | null;
  imageBuffer: Uint8Array | null;
  mimeType: string | null;
}

/**
 * Downloads a remote social cover thumbnail (returning raw bytes for Vision AI)
 * and mirrors it to Supabase Storage so short-lived CDN signatures do not expire.
 */
export async function resolveAndMirrorThumbnail(params: {
  userId: string;
  refId: string;
  sourceUrl: string | null | undefined;
}): Promise<MirroredThumbnailResult> {
  const rawUrl = params.sourceUrl?.trim();
  if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) {
    return { publicUrl: null, imageBuffer: null, mimeType: null };
  }

  let imageBuffer: Uint8Array | null = null;
  let mimeType: string | null = null;

  try {
    const res = await fetch(rawUrl, {
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RMSBot/1.0)",
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
      },
    });

    if (res.ok) {
      const ct = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (ct.startsWith("image/") && !ct.includes("svg")) {
        const arr = await res.arrayBuffer();
        if (arr.byteLength > 0 && arr.byteLength <= MAX_BYTES) {
          imageBuffer = new Uint8Array(arr);
          mimeType = ct;
        }
      }
    }
  } catch {
    return { publicUrl: rawUrl, imageBuffer: null, mimeType: null };
  }

  if (!imageBuffer || !mimeType) {
    return { publicUrl: rawUrl, imageBuffer: null, mimeType: null };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (supabaseUrl && rawUrl.startsWith(supabaseUrl) && rawUrl.includes(`/storage/v1/object/public/${BUCKET_NAME}/`)) {
    return { publicUrl: rawUrl, imageBuffer, mimeType };
  }

  const admin = getAdminStorageClient();
  if (!admin) {
    return { publicUrl: rawUrl, imageBuffer, mimeType };
  }

  try {
    if (!bucketEnsured) {
      const { data: bucket } = await admin.storage.getBucket(BUCKET_NAME);
      if (!bucket) {
        await admin.storage.createBucket(BUCKET_NAME, {
          public: true,
          fileSizeLimit: MAX_BYTES,
        });
      }
      bucketEnsured = true;
    }

    const ext = extensionFromMime(mimeType);
    const objectPath = `${params.userId}/${params.refId}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from(BUCKET_NAME)
      .upload(objectPath, imageBuffer, {
        contentType: mimeType,
        upsert: true,
        cacheControl: "31536000",
      });

    if (!uploadError) {
      const { data: urlData } = admin.storage.from(BUCKET_NAME).getPublicUrl(objectPath);
      if (urlData?.publicUrl) {
        return {
          publicUrl: urlData.publicUrl,
          imageBuffer,
          mimeType,
        };
      }
    }
  } catch {
    // Gracefully retain original URL & image buffer if Storage upload fails
  }

  return { publicUrl: rawUrl, imageBuffer, mimeType };
}

const MAX_VIDEO_BYTES = 16 * 1024 * 1024;

export interface AiVideoAttachment {
  data: Uint8Array;
  mediaType: string;
}

/**
 * Downloads a short-form social video (.mp4) bounded cleanly for multimodal Gemini AI analysis.
 */
export async function fetchVideoBytesForAi(
  videoUrl: string | null | undefined
): Promise<AiVideoAttachment | null> {
  const cleanUrl = videoUrl?.trim();
  if (!cleanUrl || !/^https?:\/\//i.test(cleanUrl)) {
    return null;
  }

  try {
    const res = await fetch(cleanUrl, {
      signal: AbortSignal.timeout(9000),
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "video/mp4,video/*;q=0.9,*/*;q=0.5",
      },
    });

    if (!res.ok) return null;

    const lenHeader = Number.parseInt(res.headers.get("content-length") || "0", 10);
    if (Number.isFinite(lenHeader) && lenHeader > MAX_VIDEO_BYTES) {
      return null;
    }

    const rawCt = (res.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const looksLikeMp4 =
      rawCt.startsWith("video/") ||
      (rawCt === "application/octet-stream" && /\.mp4(?:$|\?)/i.test(cleanUrl));
    if (!looksLikeMp4) {
      return null;
    }

    const arr = await res.arrayBuffer();
    if (arr.byteLength < 1024 || arr.byteLength > MAX_VIDEO_BYTES) {
      return null;
    }

    return {
      data: new Uint8Array(arr),
      mediaType: rawCt.startsWith("video/") ? rawCt : "video/mp4",
    };
  } catch {
    return null;
  }
}
