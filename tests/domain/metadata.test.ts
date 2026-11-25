import { describe, it, expect } from "vitest";
import {
  extractHandleFromProfileUrl,
  extractHashtagsFromText,
  extractInstagramHydratedMedia,
  extractInstagramOrAuthorFromTitle,
  extractSharedText,
  extractTikTokHydratedMedia,
  normalizeSocialHandle,
  parseAudioFromText,
  parseOpenGraphMeta,
} from "@/lib/ingest/metadata";

describe("metadata extraction helpers", () => {
  it("normalizes social handles and ignores reserved route segments", () => {
    expect(normalizeSocialHandle("@Creator.ID")).toBe("creator.id");
    expect(normalizeSocialHandle("https://invalid")).toBeNull();
    expect(normalizeSocialHandle("reel")).toBeNull();
    expect(normalizeSocialHandle("shorts")).toBeNull();
    expect(normalizeSocialHandle("  @alif_studio/?ref=share ")).toBe("alif_studio");
  });

  it("extracts shared caption text around URLs from share sheets", () => {
    const raw =
      "Check this editing breakdown! https://www.tiktok.com/@editor/video/1234567890?is_from_webapp=1 #editing #reels";
    expect(
      extractSharedText(raw, "https://www.tiktok.com/@editor/video/1234567890")
    ).toBe("Check this editing breakdown! #editing #reels");
    expect(extractSharedText("https://vt.tiktok.com/abc123/")).toBeNull();
  });

  it("extracts deduplicated hashtags while filtering pure numbers", () => {
    const tags = extractHashtagsFromText(
      "Tips konten #Editing #editing #BikinKonten #123 #ReelsIndonesia."
    );
    expect(tags).toEqual(["editing", "bikinkonten", "reelsindonesia"]);
  });

  it("extracts handle from social profile URLs", () => {
    expect(
      extractHandleFromProfileUrl("https://www.tiktok.com/@khalid_creative", "tiktok")
    ).toBe("khalid_creative");
    expect(
      extractHandleFromProfileUrl("https://www.youtube.com/@MKBHD", "youtube")
    ).toBe("mkbhd");
    expect(
      extractHandleFromProfileUrl("https://www.instagram.com/design.by.me/", "instagram")
    ).toBe("design.by.me");
    expect(
      extractHandleFromProfileUrl("https://www.instagram.com/reel/CxYz123/", "instagram")
    ).toBeNull();
  });

  it("parses Instagram / Threads creator names and captions from og:title", () => {
    const parsed = extractInstagramOrAuthorFromTitle(
      'Rafi Pratama (@rafi.visuals) • Instagram photos and videos',
      "instagram"
    );
    expect(parsed.authorName).toBe("Rafi Pratama");
    expect(parsed.authorHandle).toBe("rafi.visuals");

    const onIg = extractInstagramOrAuthorFromTitle(
      'studio.karya on Instagram: "Cara bikin hook 3 detik pertama"',
      "instagram"
    );
    expect(onIg.authorHandle).toBe("studio.karya");
    expect(onIg.cleanedTitle).toBe("Cara bikin hook 3 detik pertama");
  });

  it("parses OpenGraph meta tags and decodes HTML entities", () => {
    const html = `
      <html>
        <head>
          <title>Fallback Title</title>
          <meta property="og:title" content="How I film B-Roll &amp; Lighting" />
          <meta content="Quick tutorial on 3-point lighting &#39;at home&#39;" property="og:description" />
          <meta property="og:image" content="https://cdn.example.com/thumb.jpg" />
          <meta name="author" content="Studio Keren" />
        </head>
      </html>
    `;
    const meta = parseOpenGraphMeta(html);
    expect(meta.title).toBe("How I film B-Roll & Lighting");
    expect(meta.description).toBe("Quick tutorial on 3-point lighting 'at home'");
    expect(meta.image).toBe("https://cdn.example.com/thumb.jpg");
    expect(meta.author).toBe("Studio Keren");
  });

  it("parses explicit audio signatures without inventing audio from plain text", () => {
    expect(parseAudioFromText("♬ original sound - StudioVisual")).toEqual({
      audioTitle: "original sound",
      audioArtist: "StudioVisual",
    });
    expect(parseAudioFromText("suara asli - StudioVisual")).toEqual({
      audioTitle: "suara asli - StudioVisual",
      audioArtist: "StudioVisual",
    });
    expect(parseAudioFromText("Just a normal caption about filming")).toEqual({
      audioTitle: null,
      audioArtist: null,
    });
  });

  it("extracts Instagram hydrated JSON video, audio, handle, and caption for target shortcode", () => {
    const payload = {
      items: [
        {
          code: "OTHER999",
          caption: { text: "Wrong post caption" },
          user: { username: "someone_else", full_name: "Other" },
          video_versions: [{ url: "https://cdn.example.com/other.mp4" }],
        },
        {
          code: "DeXUx-UOhwu",
          caption: { text: "All black sidewalk fit check" },
          user: { username: "utochkavtapkah", full_name: "VIRA" },
          clips_metadata: {
            music_info: null,
            original_sound_info: {
              original_audio_title: "Original audio",
              ig_artist: { username: "utochkavtapkah" },
            },
          },
          image_versions2: {
            candidates: [{ url: "https://cdn.example.com/cover.jpg" }],
          },
          video_versions: [{ url: "https://cdn.example.com/reel.mp4" }],
        },
      ],
    };
    const html = `<html><script type="application/json">${JSON.stringify(payload)}</script></html>`;

    const extracted = extractInstagramHydratedMedia(html, "DeXUx-UOhwu");
    expect(extracted).toEqual({
      caption: "All black sidewalk fit check",
      authorName: "VIRA",
      authorHandle: "utochkavtapkah",
      coverUrl: "https://cdn.example.com/cover.jpg",
      videoUrl: "https://cdn.example.com/reel.mp4",
      audioTitle: "Original audio",
      audioArtist: "utochkavtapkah",
      accessibilityCaption: null,
    });
  });

  it("extracts TikTok hydrated JSON video, music, creator, and description", () => {
    const ttPayload = {
      __DEFAULT_SCOPE__: {
        "webapp.video-detail": {
          itemInfo: {
            itemStruct: {
              desc: "Minimalist street OOTD #fashion #ootd",
              author: { uniqueId: "style.creator", nickname: "Style Creator" },
              music: { title: "Night Drive Synth", authorName: "DJ Test" },
              video: {
                cover: "https://cdn.example.com/tt-cover.jpg",
                playAddr: "https://cdn.example.com/tt-video.mp4",
              },
            },
          },
        },
      },
    };
    const html = `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify(ttPayload)}</script>`;

    const extracted = extractTikTokHydratedMedia(html);
    expect(extracted).toEqual({
      caption: "Minimalist street OOTD #fashion #ootd",
      authorName: "Style Creator",
      authorHandle: "style.creator",
      coverUrl: "https://cdn.example.com/tt-cover.jpg",
      videoUrl: "https://cdn.example.com/tt-video.mp4",
      audioTitle: "Night Drive Synth",
      audioArtist: "DJ Test",
      accessibilityCaption: null,
    });
  });
});
