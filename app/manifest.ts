import type { MetadataRoute } from "next";

// PWA manifest. Outstanding item #8 in docs/mobile-audit.md.
//
// There is no native app yet, so the installed web app is the phone
// experience. `standalone` is the whole point: launched from the home screen
// it loses the browser chrome, which is the difference between "a website I
// bookmarked" and "the app I open at the vet's front desk".
//
// start_url is the dashboard rather than the marketing home, because someone
// who has installed this is signed in and wants their pets, not the pitch.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pawdex: your pets' medical records",
    short_name: "Pawdex",
    description:
      "Every vet record for every pet, in one dated, cited timeline that travels with the animal for life.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Matches --pw-bg in the light theme, so the splash and the first paint
    // are the same colour and there is no white flash on launch.
    background_color: "#EDEEF0",
    theme_color: "#EDEEF0",
    categories: ["medical", "lifestyle", "productivity"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
  };
}
