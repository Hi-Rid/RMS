import { ImageResponse } from "next/og";
import { RMS_CREST_PATH } from "@/components/app/brand-logo";

export const alt = "RMS — Reference Management & Content Studio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#FCFBF8",
          padding: 48,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#FFFFFF",
            border: "2px solid #E4E2DC",
            borderRadius: 24,
            padding: "56px 72px",
            gap: 20,
          }}
        >
          <svg
            width="116"
            height="110"
            viewBox="61 97 1145 1074"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path fill="#800115" fillRule="evenodd" d={RMS_CREST_PATH} />
          </svg>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 14,
            }}
          >
            <span
              style={{
                fontSize: 64,
                fontWeight: 900,
                letterSpacing: "-0.04em",
                color: "#14140F",
              }}
            >
              RMS
            </span>
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#800115",
                letterSpacing: "0.08em",
              }}
            >
              v2.0
            </span>
          </div>
          <div
            style={{
              fontSize: 24,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#6B6B62",
            }}
          >
            Reference Management &amp; Content Studio
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
