import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Cream shield-paw mark on the brand green, for iOS home-screen bookmarks. Same
// mark geometry as icon.svg, handed to Satori as a data URI so its path parser
// stays out of the way.
const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 32 32"><path fill-rule="evenodd" clip-rule="evenodd" fill="#FAF9F6" d="M16 3L26 5.5Q27 5.75 27 7L27 15.5C27 21.8 22.4 26.4 16 29C9.6 26.4 5 21.8 5 15.5L5 7Q5 5.75 6 5.5Z M8.9 12.6a1.7 2 0 1 0 3.4 0a1.7 2 0 1 0 -3.4 0Z M11.9 10a1.8 2.1 0 1 0 3.6 0a1.8 2.1 0 1 0 -3.6 0Z M16.5 10a1.8 2.1 0 1 0 3.6 0a1.8 2.1 0 1 0 -3.6 0Z M19.7 12.6a1.7 2 0 1 0 3.4 0a1.7 2 0 1 0 -3.4 0Z M11.8 18.4a4.2 3.5 0 1 0 8.4 0a4.2 3.5 0 1 0 -8.4 0Z"/></svg>`;

const markSrc = `data:image/svg+xml;base64,${Buffer.from(MARK_SVG).toString("base64")}`;

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2F6F4E",
        }}
      >
        { }
        <img src={markSrc} width={120} height={120} alt="" />
      </div>
    ),
    { ...size },
  );
}
