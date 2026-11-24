import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { normalizeUrl, extractUrls } from "@/lib/domain/url";
import { AppError } from "@/lib/errors";

describe("lib/domain/url.ts (PRD §10.1 & §17.1)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // #1
  it("case #1: normalizes Instagram reel with tracking param", async () => {
    const res = await normalizeUrl("https://www.instagram.com/reel/ABC123/?igsh=xyz");
    expect(res).toEqual({
      url: "https://www.instagram.com/reel/ABC123/",
      platform: "instagram",
      externalId: "ABC123",
      format: "reel",
      handle: undefined,
    });
  });

  // #2
  it("case #2: normalizes Instagram reels plural path", async () => {
    const res = await normalizeUrl("https://www.instagram.com/reels/ABC123/");
    expect(res).toEqual({
      url: "https://www.instagram.com/reel/ABC123/",
      platform: "instagram",
      externalId: "ABC123",
      format: "reel",
      handle: undefined,
    });
  });

  // #3
  it("case #3: extracts username handle from user reel path", async () => {
    const res = await normalizeUrl("https://www.instagram.com/some.user/reel/ABC123/");
    expect(res).toEqual({
      url: "https://www.instagram.com/reel/ABC123/",
      platform: "instagram",
      externalId: "ABC123",
      format: "reel",
      handle: "some.user",
    });
  });

  // #4
  it("case #4: normalizes Instagram post with utm_source, format undefined", async () => {
    const res = await normalizeUrl("https://www.instagram.com/p/XYZ789/?utm_source=ig_web_copy_link");
    expect(res).toEqual({
      url: "https://www.instagram.com/p/XYZ789/",
      platform: "instagram",
      externalId: "XYZ789",
      format: undefined,
      handle: undefined,
    });
  });

  // #5
  it("case #5: Instagram post externalId matches reel code ABC123", async () => {
    const res = await normalizeUrl("https://www.instagram.com/p/ABC123/");
    expect(res.externalId).toBe("ABC123");
  });

  // #6
  it("case #6: normalizes Instagram story with story:id externalId", async () => {
    const res = await normalizeUrl("https://instagram.com/stories/user.name/3012345678901234567/");
    expect(res).toEqual({
      url: "https://www.instagram.com/stories/user.name/3012345678901234567/",
      platform: "instagram",
      externalId: "story:3012345678901234567",
      format: "story",
      handle: "user.name",
    });
  });

  // #7
  it("case #7: normalizes TikTok video with handle and reel format", async () => {
    const res = await normalizeUrl(
      "https://www.tiktok.com/@some.user/video/7301234567890123456?is_from_webapp=1&sender_device=pc"
    );
    expect(res).toEqual({
      url: "https://www.tiktok.com/@some.user/video/7301234567890123456",
      platform: "tiktok",
      externalId: "7301234567890123456",
      format: "reel",
      handle: "some.user",
    });
  });

  // #8
  it("case #8: normalizes TikTok photo as carousel format", async () => {
    const res = await normalizeUrl("https://www.tiktok.com/@some.user/photo/7301234567890123457");
    expect(res).toEqual({
      url: "https://www.tiktok.com/@some.user/photo/7301234567890123457",
      platform: "tiktok",
      externalId: "7301234567890123457",
      format: "carousel",
      handle: "some.user",
    });
  });

  // #9
  it("case #9: resolves vm.tiktok.com short link to destination", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 301,
      headers: {
        get: (h: string) => (h.toLowerCase() === "location" ? "https://www.tiktok.com/@u/video/123?x=1" : null),
      },
    });
    vi.stubGlobal("fetch", mockFetch);

    const res = await normalizeUrl("https://vm.tiktok.com/ZMabc123/");
    expect(res).toEqual({
      url: "https://www.tiktok.com/@u/video/123",
      platform: "tiktok",
      externalId: "123",
      format: "reel",
      handle: "u",
    });
  });

  // #10
  it("case #10: handles failed resolve on vm.tiktok.com gracefully", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network failed"));
    vi.stubGlobal("fetch", mockFetch);

    const res = await normalizeUrl("https://vm.tiktok.com/ZMabc123/");
    expect(res).toEqual({
      url: "https://vm.tiktok.com/ZMabc123",
      platform: "tiktok",
      externalId: undefined,
      format: undefined,
      handle: undefined,
    });
  });

  // #11
  it("case #11: normalizes youtu.be to youtube.com/watch", async () => {
    const res = await normalizeUrl("https://youtu.be/dQw4w9WgXcQ?si=abc");
    expect(res).toEqual({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      platform: "youtube",
      externalId: "dQw4w9WgXcQ",
      format: "reel",
    });
  });

  // #12
  it("case #12: normalizes YouTube shorts", async () => {
    const res = await normalizeUrl("https://www.youtube.com/shorts/abcDEF12345?feature=share");
    expect(res).toEqual({
      url: "https://www.youtube.com/shorts/abcDEF12345",
      platform: "youtube",
      externalId: "abcDEF12345",
      format: "reel",
    });
  });

  // #13
  it("case #13: strips m. and extraneous query params on youtube.com/watch", async () => {
    const res = await normalizeUrl("https://m.youtube.com/watch?v=abc&list=PL1&t=10s");
    expect(res.url).toBe("https://www.youtube.com/watch?v=abc");
    expect(res.externalId).toBe("abc");
  });

  // #14
  it("case #14: normalizes Threads post URL and strips xmt", async () => {
    const res = await normalizeUrl("https://www.threads.net/@user/post/Cabc123?xmt=1");
    expect(res).toEqual({
      url: "https://www.threads.net/@user/post/Cabc123",
      platform: "threads",
      externalId: "Cabc123",
      format: undefined,
      handle: "user",
    });
  });

  // #15
  it("case #15: normalizes Other domain, strips utm and fragment, preserves id=5", async () => {
    const res = await normalizeUrl("https://example.com/page/?utm_source=x&id=5#frag");
    expect(res).toEqual({
      url: "https://example.com/page?id=5",
      platform: "other",
      externalId: undefined,
      format: undefined,
      handle: undefined,
    });
  });

  // #16
  it("case #16: extracts URL from conversational share text", async () => {
    const res = await normalizeUrl("Check this https://www.instagram.com/reel/ABC123/?igsh=1 wow");
    expect(res.url).toBe("https://www.instagram.com/reel/ABC123/");
    expect(res.externalId).toBe("ABC123");
  });

  // #17
  it("case #17: strips surrounding parentheses and trailing dot", async () => {
    const res = await normalizeUrl("(https://www.instagram.com/reel/ABC123/).");
    expect(res.url).toBe("https://www.instagram.com/reel/ABC123/");
    expect(res.externalId).toBe("ABC123");
  });

  // #18
  it("case #18: lowercases host while strictly preserving path case", async () => {
    const res = await normalizeUrl("HTTPS://WWW.INSTAGRAM.COM/reel/ABC123/");
    expect(res.url).toBe("https://www.instagram.com/reel/ABC123/");
    expect(res.externalId).toBe("ABC123");
  });

  // #19
  it("case #19: prepends https:// when given bare host.tld/path", async () => {
    const res = await normalizeUrl("instagram.com/reel/ABC123");
    expect(res.url).toBe("https://www.instagram.com/reel/ABC123/");
    expect(res.externalId).toBe("ABC123");
  });

  // #20
  it("case #20: throws AppError(invalid_url) for invalid inputs", async () => {
    await expect(normalizeUrl("hello world")).rejects.toThrow(AppError);
    await expect(normalizeUrl("ftp://x.com/a")).rejects.toThrow(AppError);
    await expect(normalizeUrl("javascript:alert(1)")).rejects.toThrow(AppError);
    await expect(normalizeUrl("")).rejects.toThrow(AppError);
  });

  // #21
  it("case #21: extractUrls decodes escaped slashes in JSON", () => {
    const urls = extractUrls('{"l":"https:\\/\\/www.instagram.com\\/reel\\/ABC123\\/"}');
    expect(urls).toEqual(["https://www.instagram.com/reel/ABC123/"]);
  });

  // #22
  it("case #22: extractUrls returns all 3 URLs sequentially in order", () => {
    const text = `
      First: https://www.instagram.com/reel/ABC123/
      Second: https://www.tiktok.com/@u/video/456
      Third duplicate: https://www.instagram.com/reel/ABC123/
    `;
    const urls = extractUrls(text);
    expect(urls).toEqual([
      "https://www.instagram.com/reel/ABC123/",
      "https://www.tiktok.com/@u/video/456",
      "https://www.instagram.com/reel/ABC123/",
    ]);
  });
});
