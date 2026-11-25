import "server-only";
import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { appSettings, contents } from "@/db/schema";
import { getOwner } from "@/lib/auth/owner";
import { env } from "@/lib/env";
import { buildPlannerIcs } from "@/lib/planner/ics";

async function resolveCalendarUserId(request: NextRequest): Promise<{
  userId: string;
  viaToken: boolean;
} | null> {
  const tokenParam = request.nextUrl.searchParams.get("token")?.trim();
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const token = tokenParam || bearer;

  if (token) {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const [row] = await db
      .select({ userId: appSettings.userId })
      .from(appSettings)
      .where(eq(appSettings.ingestTokenHash, tokenHash))
      .limit(1);

    if (row) {
      return { userId: row.userId, viaToken: true };
    }
    return null;
  }

  const owner = await getOwner();
  if (!owner) return null;
  return { userId: owner.id, viaToken: false };
}

export async function GET(request: NextRequest) {
  const resolved = await resolveCalendarUserId(request);
  if (!resolved) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized. Sign in or supply a valid calendar token." },
      { status: 401 }
    );
  }

  try {
    const rows = await db
      .select({
        id: contents.id,
        title: contents.title,
        plannedFor: contents.plannedFor,
        status: contents.status,
        hookText: contents.hookText,
        notes: contents.notes,
        workUrl: contents.workUrl,
      })
      .from(contents)
      .where(
        and(
          eq(contents.userId, resolved.userId),
          isNull(contents.archivedAt),
          isNotNull(contents.plannedFor)
        )
      )
      .orderBy(asc(contents.plannedFor));

    const validRows = rows.filter(
      (r): r is typeof r & { plannedFor: string } => Boolean(r.plannedFor)
    );

    const ics = buildPlannerIcs(validRows, {
      calendarName: "RMS Content Planner",
      appUrl: env.NEXT_PUBLIC_APP_URL,
    });

    const disposition = resolved.viaToken
      ? 'inline; filename="rms-planner.ics"'
      : 'attachment; filename="rms-planner.ics"';

    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": disposition,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Failed to generate planner ICS feed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to generate calendar export" },
      { status: 500 }
    );
  }
}
