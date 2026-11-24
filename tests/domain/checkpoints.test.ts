import { describe, it, expect } from "vitest";
import { dueAt, CHECKPOINTS } from "@/lib/domain/checkpoints";

describe("lib/domain/checkpoints.ts (PRD §10.5 & §17.1)", () => {
  it("has the 3 standard checkpoint kinds", () => {
    expect(CHECKPOINTS).toEqual(["h24", "d7", "d30"]);
  });

  const baseDate = "2026-11-14T10:00:00.000Z";

  it("calculates h24 checkpoint (+24 hours)", () => {
    const due = dueAt(baseDate, "h24");
    expect(due.toISOString()).toBe("2026-11-15T10:00:00.000Z");
  });

  it("calculates d7 checkpoint (+7 days)", () => {
    const due = dueAt(baseDate, "d7");
    expect(due.toISOString()).toBe("2026-11-21T10:00:00.000Z");
  });

  it("calculates d30 checkpoint (+30 days)", () => {
    const due = dueAt(baseDate, "d30");
    expect(due.toISOString()).toBe("2026-12-14T10:00:00.000Z");
  });
});
