import type { MetadataRoute } from "next";

// Marketing surface only. The product itself is auth-gated, so nothing under
// the (app) group belongs in a public sitemap. The home page lives at "/" for
// visitors (middleware rewrites "/" to the marketing home for anonymous
// traffic), so the canonical marketing URL is the bare origin.
const BASE = "https://www.pawdex.co";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: BASE, lastModified, changeFrequency: "weekly", priority: 1 },
    {
      url: `${BASE}/pricing`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${BASE}/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${BASE}/accessibility`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
