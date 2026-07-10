import type { MetadataRoute } from "next";

const BASE = "https://www.pawdex.co";

// Allow crawlers on the marketing surface; keep them out of the API and every
// authenticated or token-gated path (nothing there is meant to be indexed, and
// the token pages carry one-time secrets in the URL).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/pets/",
        "/documents/",
        "/inbox/",
        "/insurance/",
        "/breeding/",
        "/vets/",
        "/reminders/",
        "/expiring/",
        "/settings/",
        "/ask/",
        "/onboarding/",
        "/login/",
        "/auth/",
        "/invite/",
        "/transfer/",
        "/share/",
      ],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
