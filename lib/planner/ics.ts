export interface PlannerIcsEvent {
  id: string;
  title: string;
  plannedFor: string; // YYYY-MM-DD
  status?: string | null;
  hookText?: string | null;
  notes?: string | null;
  workUrl?: string | null;
}

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function formatDateValue(ymd: string): string | null {
  const match = ymd.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return `${match[1]}${match[2]}${match[3]}`;
}

function nextDayYmd(ymd: string): string | null {
  const match = ymd.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const dt = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function formatUtcTimestamp(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

export function buildPlannerIcs(
  events: PlannerIcsEvent[],
  options?: { calendarName?: string; appUrl?: string; now?: Date }
): string {
  const calName = options?.calendarName || "RMS Content Planner";
  const nowStamp = formatUtcTimestamp(options?.now ?? new Date());
  const baseUrl = (options?.appUrl || "").replace(/\/+$/, "");

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RMS//Reference Management System//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calName)}`,
  ];

  for (const ev of events) {
    const dtStart = formatDateValue(ev.plannedFor);
    const dtEnd = nextDayYmd(ev.plannedFor);
    if (!dtStart || !dtEnd) continue;

    const descParts: string[] = [];
    if (ev.status) descParts.push(`Status: ${ev.status}`);
    if (ev.hookText) descParts.push(`Hook: ${ev.hookText}`);
    if (ev.notes) descParts.push(`Notes: ${ev.notes.slice(0, 400)}`);
    if (ev.workUrl) descParts.push(`Work URL: ${ev.workUrl}`);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.id}@rms.local`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
    lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
    lines.push(`SUMMARY:${escapeIcsText(ev.title)}`);
    if (descParts.length > 0) {
      lines.push(`DESCRIPTION:${escapeIcsText(descParts.join("\n"))}`);
    }
    if (baseUrl) {
      lines.push(`URL:${baseUrl}/contents/${ev.id}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
