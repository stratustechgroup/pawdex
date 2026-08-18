import type { Metadata } from "next";
import { Archivo } from "next/font/google";

import "./marketing.css";
import { MarketingThemeInit } from "@/components/marketing/theme-init";
import {
  JsonLd,
  organizationSchema,
  webSiteSchema,
} from "@/components/marketing/structured-data";

// One family for the whole marketing surface, carried by its width axis:
// Archivo Expanded for display, normal width for body. Archivo is a grotesque
// drawn for signage and print at small sizes, which is the right register for a
// product whose entire promise is a permanent, legible record.
//
// It replaces Fraunces (display) and Inter (body). Both were deliberate
// removals: an editorial serif plus Inter is the single most recognisable
// machine-generated type pairing on the web, and neither said anything about
// what this product is.
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  axes: ["wdth"],
});

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
      <div className={`mk ${archivo.variable}`}>{children}</div>
    </>
  );
}
