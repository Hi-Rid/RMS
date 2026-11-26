import { describe, it, expect } from "vitest";
import {
  normalizeTag,
  normalizeHandle,
  slugify,
  matchHookTypeId,
  buildCreatorProfileUrl,
} from "@/lib/domain/normalize";

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

  describe("matchHookTypeId", () => {
    const sampleHooks = [
      { id: "id-pov", name: "POV", slug: "pov" },
      { id: "id-curiosity", name: "Curiosity gap (wait for it)", slug: "curiosity-gap" },
      { id: "id-mistake", name: "Stop doing this (mistake)", slug: "mistake" },
    ];

    it("matches by slug phrase inside verbose AI guess", () => {
      expect(matchHookTypeId("Negative Curiosity Gap & FOMO", sampleHooks)).toBe("id-curiosity");
    });

    it("matches exact or partial name case-insensitively", () => {
      expect(matchHookTypeId("pov scene", sampleHooks)).toBe("id-pov");
    });

    it("returns null when no hook matches or guess is empty", () => {
      expect(matchHookTypeId("", sampleHooks)).toBeNull();
      expect(matchHookTypeId("Unrecognized Format", sampleHooks)).toBeNull();
    });
  });

  describe("buildCreatorProfileUrl", () => {
    it("builds canonical creator profile URLs for supported platforms", () => {
      expect(buildCreatorProfileUrl("instagram", "@Sueeeecy")).toBe(
        "https://www.instagram.com/sueeeecy/"
      );
      expect(buildCreatorProfileUrl("tiktok", "mybettas")).toBe(
        "https://www.tiktok.com/@mybettas"
      );
      expect(buildCreatorProfileUrl("x", "@user")).toBe("https://x.com/user");
    });

    it("returns null for unsupported platform or empty handle", () => {
      expect(buildCreatorProfileUrl("other", "creator")).toBeNull();
      expect(buildCreatorProfileUrl("instagram", "@@@")).toBeNull();
    });
  });
});
