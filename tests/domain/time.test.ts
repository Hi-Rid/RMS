import { describe, it, expect } from "vitest";
import { startOfWeek } from "@/lib/domain/time";

describe("lib/domain/time.ts (PRD §10.10 & §17.1)", () => {
  it("calculates startOfWeek (Monday 00:00 WIB) for Saturday 2026-11-14", () => {
    // Saturday 2026-11-14T10:00Z is Saturday 17:00 WIB.
    // The Monday of this week in WIB is 2026-11-09 00:00:00 WIB.
    // In UTC, that equals 2026-11-08T17:00:00.000Z.
    const date = new Date("2026-11-14T10:00:00.000Z");
    const monday = startOfWeek(date);
    expect(monday.toISOString()).toBe("2026-11-08T17:00:00.000Z");
  });
});
