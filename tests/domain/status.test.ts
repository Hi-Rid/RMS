import { describe, it, expect } from "vitest";
import {
  deriveContentStatus,
  isAllowedRefTransition,
} from "@/lib/domain/status";

describe("lib/domain/status.ts (PRD §10.3 & §17.1)", () => {
  describe("deriveContentStatus", () => {
    it("returns production when no posts exist {postCount:0, doneSnapshotCount:0}", () => {
      expect(deriveContentStatus({ postCount: 0, doneSnapshotCount: 0 })).toBe("production");
    });

    it("returns posted when post exists but no done snapshots {postCount:1, doneSnapshotCount:0}", () => {
      expect(deriveContentStatus({ postCount: 1, doneSnapshotCount: 0 })).toBe("posted");
    });

    it("returns evaluating when at least one snapshot is done {postCount:1, doneSnapshotCount:2}", () => {
      expect(deriveContentStatus({ postCount: 1, doneSnapshotCount: 2 })).toBe("evaluating");
    });

    it("returns production if post is deleted even if done snapshot existed {postCount:0, doneSnapshotCount:1}", () => {
      expect(deriveContentStatus({ postCount: 0, doneSnapshotCount: 1 })).toBe("production");
    });
  });

  describe("isAllowedRefTransition", () => {
    it("allows manual transitions between inbox, selected, and skipped when !hasContent", () => {
      expect(isAllowedRefTransition("inbox", "selected", false)).toBe(true);
      expect(isAllowedRefTransition("selected", "skipped", false)).toBe(true);
      expect(isAllowedRefTransition("skipped", "inbox", false)).toBe(true);
      expect(isAllowedRefTransition("selected", "inbox", false)).toBe(true);
      expect(isAllowedRefTransition("skipped", "selected", false)).toBe(true);
    });

    it("forbids manual jump to production", () => {
      expect(isAllowedRefTransition("inbox", "production", false)).toBe(false);
    });

    it("forbids manual transition back from production", () => {
      expect(isAllowedRefTransition("production", "selected", false)).toBe(false);
    });

    it("forbids manual transition if reference has content (hasContent = true)", () => {
      expect(isAllowedRefTransition("selected", "skipped", true)).toBe(false);
      expect(isAllowedRefTransition("inbox", "selected", true)).toBe(false);
    });

    it("forbids transitioning to the exact same status", () => {
      expect(isAllowedRefTransition("inbox", "inbox", false)).toBe(false);
    });
  });
});
