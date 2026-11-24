import { describe, it, expect } from "vitest";
import { normalizeTag, normalizeHandle, slugify } from "@/lib/domain/normalize";

describe("lib/domain/normalize.ts (PRD §10.7 & §17.1)", () => {
  describe("normalizeTag", () => {
    it("strips # and lowercases: #OOTD -> ootd", () => {
      expect(normalizeTag("#OOTD")).toBe("ootd");
    });

    it("replaces whitespace with dash: ' Street Style ' -> 'street-style'", () => {
      expect(normalizeTag(" Street Style ")).toBe("street-style");
    });

    it("removes invalid symbols: 'a!!b' -> 'ab'", () => {
      expect(normalizeTag("a!!b")).toBe("ab");
    });

    it("returns empty string if only invalid symbols: '!!!' -> ''", () => {
      expect(normalizeTag("!!!")).toBe("");
    });

    it("truncates tags longer than 40 characters", () => {
      const longTag = "a".repeat(60);
      expect(normalizeTag(longTag)).toBe("a".repeat(40));
    });

    it("preserves Unicode characters: 'Café' -> 'café'", () => {
      expect(normalizeTag("Café")).toBe("café");
    });
  });

  describe("normalizeHandle", () => {
    it("strips @, trims, lowercases: '@Some.User ' -> 'some.user'", () => {
      expect(normalizeHandle("@Some.User ")).toBe("some.user");
    });

    it("removes all spaces: 'a b' -> 'ab'", () => {
      expect(normalizeHandle("a b")).toBe("ab");
    });
  });

  describe("slugify", () => {
    it("generates url-friendly slug: 'Fashion / OOTD' -> 'fashion-ootd'", () => {
      expect(slugify("Fashion / OOTD")).toBe("fashion-ootd");
    });

    it("collapses commas and spaces: 'Art, sketching, journal' -> 'art-sketching-journal'", () => {
      expect(slugify("Art, sketching, journal")).toBe("art-sketching-journal");
    });

    it("returns empty string for pure whitespace: '  ' -> ''", () => {
      expect(slugify("  ")).toBe("");
    });
  });
});
