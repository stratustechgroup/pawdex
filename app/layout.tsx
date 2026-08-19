import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

// One superfamily for the whole product. IBM Plex was drawn as a technical and
// documentation face: slightly mechanical, holds up at small sizes, and its
// mono has genuinely good tabular figures, which matters on a surface where
// almost every meaningful value is a date, a dose, or a weight.
//
// It replaces Inter (body), Source Serif (display) and JetBrains Mono (data).
// The serif was doing "trustworthy editorial" in an app that needs "accurate
// instrument", and Inter is the default typeface of generated product UI.
//
// Loading Inter here was also the reason the marketing surface downloaded a
// font it never rendered: this route's layout wraps every route group.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.pawdex.co"),
  title: "Pawdex: your pets' medical records, organized",
  description:
    "Upload any vet document (vaccine certs, SOAP notes, lab reports) and Pawdex keeps your pet's medical history searchable and on schedule.",
};

// Outstanding item #8 in docs/mobile-audit.md: safe-area metadata and a
// theme colour.
//
// viewportFit "cover" is what makes env(safe-area-inset-*) return anything
// other than zero on a notched phone. Every pinned element on this surface
// (the bottom tab bar, the review-form footer) reads those insets, so without
// this line they all sit under the home indicator.
//
// themeColor is declared per scheme so the browser chrome matches the page in
// both, and both values are the --pw-bg of their theme.
//
// Zoom is deliberately NOT capped: no maximumScale, no userScalable false. On
// a medical record, pinching to read a dose is not a behaviour to design out.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EDEEF0" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1214" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors closeButton />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
