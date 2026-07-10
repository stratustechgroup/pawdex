import type { Metadata } from "next";
import { Fraunces } from "next/font/google";

import "./marketing.css";
import { MarketingThemeInit } from "@/components/marketing/theme-init";

// Display face for the marketing surface only. The app itself stays on Inter;
// Fraunces at high optical sizes gives the public page its editorial voice.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT", "WONK"],
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
// session lookup — this route group renders for anonymous visitors.
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MarketingThemeInit />
      <div className={`mk ${fraunces.variable}`}>{children}</div>
    </>
  );
}
