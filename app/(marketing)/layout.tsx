import type { Metadata } from "next";

import "./marketing.css";
import { MarketingThemeInit } from "@/components/marketing/theme-init";

export const metadata: Metadata = {
  title: "Pawdex: every vet record, one timeline, for life",
  description:
    "Forward or snap any vet document and Pawdex turns it into a structured, source-cited medical history that travels with your pet forever. Join the early-access waitlist.",
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
      <div className="mk">{children}</div>
    </>
  );
}
