import type { Metadata } from "next";

import "./marketing.css";
import { MarketingThemeInit } from "@/components/marketing/theme-init";
import {
  JsonLd,
  organizationSchema,
  webSiteSchema,
} from "@/components/marketing/structured-data";

// No font is loaded here any more.
//
// The marketing surface used to load Archivo on top of the root layout's
// families, giving this route group a typeface the product did not have. That
// was the parallel-design-system problem in its most literal form: a visitor
// read the pitch in one voice and the product in another, and the page paid
// for a third font download to do it.
//
// Marketing now inherits IBM Plex Sans and IBM Plex Mono from the root layout,
// which is also where the product gets them. See docs/design-system.md.

const TITLE = "Pawdex: every vet record, one timeline, for life";
const DESCRIPTION =
  "Forward or snap any vet document and Pawdex turns it into a structured, source-cited medical history that travels with your pet forever. Join the early-access waitlist.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Pawdex",
    url: "/",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// Public marketing shell. Deliberately free of the app's auth'd top nav and
// session lookup. This route group renders for anonymous visitors.
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MarketingThemeInit />
      {/* Sitewide structured data: present on every marketing route. */}
      <JsonLd data={organizationSchema()} />
      <JsonLd data={webSiteSchema()} />
      <div className="mk">{children}</div>
    </>
  );
}
