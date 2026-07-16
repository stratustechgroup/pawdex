import type { MetadataRoute } from "next";

const BASE = "https://www.pawdex.co";

// Allow crawlers on the marketing surface; keep them out of the API and every
// authenticated or token-gated path. Nothing under the (app) group is meant to
// be indexed (it resolves at root paths because the group is unprefixed), and
// the token pages carry one-time secrets in the URL.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        // API surface.
        "/api/",
        // Authenticated (app) surfaces, which resolve at root paths.
        "/settings/",
        "/pets/",
        "/inbox",
        "/ask",
        "/insurance/",
        "/vets/",
        "/expiring",
        "/documents",
        "/reminders",
        "/breeding",
        "/onboarding",
        // Auth and one-time-token flows (invite / transfer / share carry
        // secrets in the URL, so they must never be indexed).
        "/login/",
        "/auth/",
        "/invite/",
        "/transfer/",
        "/share/",
        // Unlisted architecture walkthrough: reachable by direct link only,
        // never indexed or crawled.
        "/architecture",
      ],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
