import { ImageResponse } from "next/og";

export const alt =
  "Pawdex: every vet record, one timeline, for life";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The shield-paw mark, drawn once as an SVG and handed to Satori as a data URI.
// Satori's own path renderer is fussy about the Q/arc commands in the mark, so
// we let it treat the whole thing as an <img> instead. Forest green on the
// cream field, matching the product's brand tokens.
const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 32 32"><path fill-rule="evenodd" clip-rule="evenodd" fill="#2F6F4E" d="M16 3L26 5.5Q27 5.75 27 7L27 15.5C27 21.8 22.4 26.4 16 29C9.6 26.4 5 21.8 5 15.5L5 7Q5 5.75 6 5.5Z M8.9 12.6a1.7 2 0 1 0 3.4 0a1.7 2 0 1 0 -3.4 0Z M11.9 10a1.8 2.1 0 1 0 3.6 0a1.8 2.1 0 1 0 -3.6 0Z M16.5 10a1.8 2.1 0 1 0 3.6 0a1.8 2.1 0 1 0 -3.6 0Z M19.7 12.6a1.7 2 0 1 0 3.4 0a1.7 2 0 1 0 -3.4 0Z M11.8 18.4a4.2 3.5 0 1 0 8.4 0a4.2 3.5 0 1 0 -8.4 0Z"/></svg>`;

const markSrc = `data:image/svg+xml;base64,${Buffer.from(MARK_SVG).toString("base64")}`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "#FAF9F6",
          color: "#14181B",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          { }
          <img src={markSrc} width={110} height={110} alt="" />
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              letterSpacing: "-0.03em",
            }}
          >
            Pawdex
          </div>
        </div>
        <div
          style={{
            marginTop: 44,
            fontSize: 46,
            lineHeight: 1.25,
            fontWeight: 600,
            maxWidth: 900,
            color: "#14181B",
          }}
        >
          Every vet record, one timeline, for life.
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 28,
            lineHeight: 1.4,
            maxWidth: 880,
            color: "#404750",
          }}
        >
          Forward or snap any vet document. Pawdex turns it into a structured,
          source-cited medical history that travels with your pet.
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: "100%",
            height: 14,
            background: "#2F6F4E",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
