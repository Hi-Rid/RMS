import { describe, it, expect } from "vitest";
import { buildPlannerIcs, escapeIcsText } from "@/lib/planner/ics";

describe("lib/planner/ics.ts", () => {
  it("escapes RFC 5545 reserved characters correctly", () => {
    expect(escapeIcsText("Hook; A, B\\C\nLine 2")).toBe("Hook\\; A\\, B\\\\C\\nLine 2");
  });

  it("builds a valid VCALENDAR with normalized all-day VEVENT dates", () => {
    const ics = buildPlannerIcs(
      [
        {
          id: "abc-123",
          title: "Launch Reel, Part 1; Demo",
          plannedFor: "2026-11-30",
          status: "production",
          hookText: "Stop scrolling\nRead this",
          notes: "B-roll transitions",
          workUrl: null,
        },
        {
          id: "skip-me",
          title: "Invalid date",
          plannedFor: "not-a-date",
        },
      ],
      {
        calendarName: "RMS Planner Test",
        appUrl: "https://rms.example.com/",
        now: new Date(Date.UTC(2026, 10, 25, 8, 30, 0)),
      }
    );

    expect(ics).toContain("BEGIN:VCALENDAR\r\nVERSION:2.0");
    expect(ics).toContain("X-WR-CALNAME:RMS Planner Test");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:abc-123@rms.local");
    expect(ics).toContain("DTSTAMP:20261125T083000Z");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261130");
    expect(ics).toContain("DTEND;VALUE=DATE:20261201");
    expect(ics).toContain("SUMMARY:Launch Reel\\, Part 1\\; Demo");
    expect(ics).toContain("URL:https://rms.example.com/contents/abc-123");
    expect(ics).not.toContain("skip-me");
    expect(ics).toContain("END:VCALENDAR");
  });
});
