import { type NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { appSettings, systemLogs } from "@/db/schema";
import { normalizeUrl, extractUrls } from "@/lib/domain/url";
import { runAiAgentForReference } from "@/lib/ai/agent";
import {
  getPlatformIdBySlug,
  getFormatIdBySlug,
  createReferenceRecord,
} from "@/lib/queries/references";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(request: NextRequest) {
  // 1. Authenticate with Bearer token & timing-safe SHA-256 compare
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { ok: false, error: { code: "unauthorized", message: "Missing or invalid Authorization header" } },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return NextResponse.json(
      { ok: false, error: { code: "unauthorized", message: "Bearer token cannot be empty" } },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  const computedHash = crypto.createHash("sha256").update(token).digest("hex");

  const [settings] = await db
    .select({
      userId: appSettings.userId,
      ingestTokenHash: appSettings.ingestTokenHash,
    })
    .from(appSettings)
    .where(eq(appSettings.ingestTokenHash, computedHash))
    .limit(1);

  if (!settings?.ingestTokenHash) {
    return NextResponse.json(
      { ok: false, error: { code: "unauthorized", message: "Invalid ingest token" } },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  const storedHash = settings.ingestTokenHash;
  const valid =
    computedHash.length === storedHash.length &&
    crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(storedHash));

  if (!valid) {
    return NextResponse.json(
      { ok: false, error: { code: "unauthorized", message: "Invalid ingest token" } },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  const userId = settings.userId;

  // 2. Parse payload (max 100 KB limit, PRD §11.1)
  const contentType = request.headers.get("content-type") || "";
  let urls: string[] = [];
  let isSingleUrl = false;
  let rawShareText: string | null = null;

  try {
    const rawBody = await request.text();
    if (rawBody.length > 100 * 1024) {
      return NextResponse.json(
        { ok: false, error: { code: "validation", message: "Payload exceeds 100 KB limit" } },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (contentType.includes("application/json")) {
      const json = JSON.parse(rawBody);
      if (typeof json.text === "string" && json.text.trim()) {
        rawShareText = json.text.trim();
      }
      if (typeof json.url === "string" && json.url.trim()) {
        urls = [json.url.trim()];
        isSingleUrl = true;
      } else if (Array.isArray(json.urls) && json.urls.length > 0) {
        urls = (json.urls as unknown[]).filter((u: unknown): u is string => typeof u === "string" && Boolean(u.trim()));
      } else if (typeof json.text === "string" && json.text.trim()) {
        urls = extractUrls(json.text);
      }
    } else {
      // Plain text payload (e.g. raw share sheet input)
      rawShareText = rawBody.trim() || null;
      urls = extractUrls(rawBody);
      if (urls.length === 0 && /^[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+\/[^\s]+$/.test(rawBody.trim())) {
        urls = [`https://${rawBody.trim()}`];
      }
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "validation", message: "Failed to parse request payload" } },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (urls.length === 0) {
    return NextResponse.json(
      { ok: false, error: { code: "validation", message: "At least one valid URL or text is required" } },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 3. Process URLs (capped at 50, PRD §11.1)
  const cappedUrls = urls.slice(0, 50);

  // Case A: Single URL
  if (isSingleUrl || cappedUrls.length === 1) {
    const targetUrl = cappedUrls[0];
    try {
      const normalized = await normalizeUrl(targetUrl);
      const platformId = await getPlatformIdBySlug(normalized.platform, userId);
      const formatId = await getFormatIdBySlug(normalized.format, userId);

      const record = await createReferenceRecord({
        userId,
        url: normalized.url,
        urlOriginal: targetUrl,
        platformId,
        externalId: normalized.externalId,
        formatId,
      });

      const agentResult = !record.isDuplicate
        ? await runAiAgentForReference({
            userId,
            refId: record.id,
            url: normalized.url,
            platformSlug: normalized.platform,
            rawInput: rawShareText || targetUrl,
            urlHandle: normalized.handle,
            externalId: normalized.externalId,
          }).catch(() => null)
        : null;

      // Audit log
      await db.insert(systemLogs).values({
        userId,
        kind: "ingest",
        level: "info",
        message: `Ingest: ${record.isDuplicate ? "duplicate" : "created"} ${normalized.platform} reference`,
        meta: {
          url: normalized.url,
          status: record.isDuplicate ? "duplicate" : "created",
          enriched: agentResult?.enriched ?? false,
          draftContentId: agentResult?.draftContentId ?? null,
        },
      });

      revalidatePath("/home");
      revalidatePath("/inbox");
      revalidatePath("/references");
      revalidatePath("/contents");

      const responseBody = {
        ok: true,
        status: record.isDuplicate ? "duplicate" : "created",
        id: record.id,
        platform: normalized.platform,
        url: normalized.url,
        archived: record.archived,
        enriched: agentResult?.enriched ?? false,
        mode: agentResult?.mode ?? "inbox",
        summary: agentResult?.summary ?? null,
        hookText: agentResult?.hookText ?? null,
        coverUrl: agentResult?.coverUrl ?? null,
        draftContentId: agentResult?.draftContentId ?? null,
        draftContentTitle: agentResult?.draftContentTitle ?? null,
        appUrl: agentResult?.draftContentId
          ? `/contents/${agentResult.draftContentId}`
          : `/references/${record.id}`,
      };

      return NextResponse.json(responseBody, {
        status: record.isDuplicate ? 200 : 201,
        headers: CORS_HEADERS,
      });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: e.code || "invalid_url",
            message: e.message || "Failed to normalize or save reference URL",
          },
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }
  }

  // Case B: Multiple URLs
  const results: Array<{
    input: string;
    status: "created" | "duplicate" | "invalid";
    id?: string;
    message?: string;
    enriched?: boolean;
    draftContentId?: string | null;
  }> = [];
  let enrichedBatchCount = 0;

  for (const raw of cappedUrls) {
    try {
      const normalized = await normalizeUrl(raw);
      const platformId = await getPlatformIdBySlug(normalized.platform, userId);
      const formatId = await getFormatIdBySlug(normalized.format, userId);

      const record = await createReferenceRecord({
        userId,
        url: normalized.url,
        urlOriginal: raw,
        platformId,
        externalId: normalized.externalId,
        formatId,
      });

      let agentRes = null;
      if (!record.isDuplicate && enrichedBatchCount < 2) {
        enrichedBatchCount++;
        agentRes = await runAiAgentForReference({
          userId,
          refId: record.id,
          url: normalized.url,
          platformSlug: normalized.platform,
          rawInput: rawShareText || raw,
          urlHandle: normalized.handle,
          externalId: normalized.externalId,
        }).catch(() => null);
      }

      results.push({
        input: raw,
        status: record.isDuplicate ? "duplicate" : "created",
        id: record.id,
        enriched: agentRes?.enriched ?? false,
        draftContentId: agentRes?.draftContentId ?? null,
        message: record.isDuplicate
          ? "Already saved"
          : agentRes?.draftContentTitle
            ? `Drafted Content: ${agentRes.draftContentTitle}`
            : agentRes?.enriched
              ? "Created & AI enriched"
              : "Created in inbox",
      });
    } catch (err: unknown) {
      const e = err as { message?: string };
      results.push({
        input: raw,
        status: "invalid",
        message: e.message || "Invalid URL",
      });
    }
  }

  // Audit log
  await db.insert(systemLogs).values({
    userId,
    kind: "ingest",
    level: "info",
    message: `Ingest batch: ${results.length} URLs processed`,
    meta: { count: results.length },
  });

  return NextResponse.json({ ok: true, results }, { status: 200, headers: CORS_HEADERS });
}
