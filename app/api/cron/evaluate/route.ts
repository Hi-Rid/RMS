import "server-only";
import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { and, asc, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { contents, platforms, posts, snapshots, systemLogs } from "@/db/schema";
import { env } from "@/lib/env";

interface DueCheckpointItem {
  snapshotId: string;
  userId: string;
  checkpoint: string;
  dueAt: string;
  postUrl: string | null;
  contentId: string;
  contentTitle: string;
  platformName: string;
}

function timingSafeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function authorizeCron(request: NextRequest): { ok: true } | { ok: false; status: number; message: string } {
  const secret = env.CRON_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, status: 503, message: "CRON_SECRET is not configured" };
    }
    return { ok: true };
  }

  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !timingSafeEquals(token, secret)) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  return { ok: true };
}

async function resolveRecipientEmail(userId: string): Promise<string | null> {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SECRET_KEY;

  if (url && serviceKey && !serviceKey.includes("your-")) {
    try {
      const admin = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data } = await admin.auth.admin.getUserById(userId);
      if (data?.user?.email) {
        return data.user.email;
      }
    } catch {
      // Fallback below
    }
  }

  return env.OWNER_EMAIL?.trim() || null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildDigestHtml(items: DueCheckpointItem[], appUrl: string): string {
  const rowsHtml = items
    .map((item) => {
      const link = item.postUrl || `${appUrl}/evaluate`;
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e5e5;font-size:13px;">
            <strong>${escapeHtml(item.contentTitle)}</strong><br/>
            <span style="color:#666;font-size:12px;">${escapeHtml(item.platformName)} · Checkpoint: ${escapeHtml(item.checkpoint)}</span>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e5e5;text-align:right;font-size:12px;">
            <a href="${escapeHtml(link)}" style="color:#800115;font-weight:bold;text-decoration:none;">Open &rarr;</a>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
      <p style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#800115;font-weight:700;margin:0 0 8px;">
        RMS · Reference Management System
      </p>
      <h2 style="margin:0 0 12px;font-size:20px;">
        ${items.length} Evaluation Checkpoint${items.length > 1 ? "s" : ""} Ready
      </h2>
      <p style="font-size:13px;color:#555;line-height:1.5;margin:0 0 18px;">
        The following published posts have reached their scheduled evaluation window. Log real metrics to train your Studio insights and track outliers.
      </p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">
        ${rowsHtml}
      </table>
      <div style="margin-top:20px;">
        <a href="${escapeHtml(appUrl)}/evaluate" style="display:inline-block;background:#800115;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">
          Go to Evaluate Queue
        </a>
      </div>
    </div>
  `;
}

async function sendResendDigest(to: string, items: DueCheckpointItem[], appUrl: string): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to,
        subject: `[RMS] ${items.length} post evaluation${items.length > 1 ? "s" : ""} due today`,
        html: buildDigestHtml(items, appUrl),
      }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const auth = authorizeCron(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const nowIso = new Date().toISOString();

  try {
    const dueRows = await db
      .select({
        snapshotId: snapshots.id,
        userId: snapshots.userId,
        checkpoint: snapshots.checkpoint,
        dueAt: snapshots.dueAt,
        postUrl: posts.url,
        contentId: contents.id,
        contentTitle: contents.title,
        platformName: platforms.name,
      })
      .from(snapshots)
      .innerJoin(posts, eq(snapshots.postId, posts.id))
      .innerJoin(contents, eq(posts.contentId, contents.id))
      .innerJoin(platforms, eq(posts.platformId, platforms.id))
      .where(and(eq(snapshots.status, "pending"), lte(snapshots.dueAt, nowIso)))
      .orderBy(asc(snapshots.dueAt))
      .limit(200);

    const byUser = new Map<string, DueCheckpointItem[]>();
    for (const row of dueRows) {
      const list = byUser.get(row.userId) ?? [];
      list.push(row);
      byUser.set(row.userId, list);
    }

    const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
    let emailsSent = 0;

    for (const [userId, items] of byUser.entries()) {
      let emailDelivered = false;
      const recipient = await resolveRecipientEmail(userId);
      if (recipient) {
        emailDelivered = await sendResendDigest(recipient, items, appUrl);
        if (emailDelivered) emailsSent++;
      }

      await db
        .insert(systemLogs)
        .values({
          userId,
          kind: "cron",
          level: "info",
          message: `Daily evaluate digest: ${items.length} due checkpoint(s)${
            emailDelivered ? " · email sent" : ""
          }`,
          meta: {
            count: items.length,
            emailDelivered,
            checkpoints: items.slice(0, 10).map((i) => ({
              snapshotId: i.snapshotId,
              title: i.contentTitle,
              checkpoint: i.checkpoint,
            })),
          },
        })
        .catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      totalDue: dueRows.length,
      usersWithDue: byUser.size,
      emailsSent,
      checkedAt: nowIso,
    });
  } catch (err) {
    console.error("Cron evaluate digest failed:", err);
    return NextResponse.json({ ok: false, error: "Cron evaluation failed" }, { status: 500 });
  }
}
