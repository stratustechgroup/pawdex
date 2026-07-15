import type { Metadata } from "next";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ContactForm } from "@/components/marketing/contact-form";
import {
  JsonLd,
  contactPageSchema,
} from "@/components/marketing/structured-data";

const TITLE = "Contact · Pawdex";
const DESCRIPTION =
  "Questions about Pawdex, early access, or your pet's records? Send us a message and a real person will get back to you within a few business days.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/contact" },
  openGraph: {
    type: "website",
    siteName: "Pawdex",
    url: "/contact",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function ContactPage() {
  return (
    <div id="top">
      <JsonLd data={contactPageSchema()} />
      <a href="#main" className="mk-skip">
        Skip to content
      </a>
      <SiteHeader />

      <main id="main">
        <section className="mk-section">
          <div className="mk-container" style={{ maxWidth: 720 }}>
            <span className="mk-eyebrow">Contact</span>
            <h1 className="mk-h2" style={{ marginTop: 16 }}>
              Talk to a <em>real person</em>.
            </h1>
            <p
              className="mk-lead"
              style={{ maxWidth: 560, marginTop: 18 }}
            >
              We are a small team building Pawdex in early access. Whether it is
              a question about your pet&apos;s records, early access, or an idea
              for the product, send it our way. We read every message.
            </p>

            <div style={{ marginTop: "clamp(28px, 4vw, 40px)" }}>
              <ContactForm />
            </div>

            <div
              className="mk-card"
              style={{
                marginTop: "clamp(28px, 4vw, 40px)",
                padding: "18px 20px",
                maxWidth: 560,
              }}
            >
              <p
                style={{
                  margin: 0,
                  font: "600 13.5px var(--mk-body)",
                  color: "var(--pw-text)",
                }}
              >
                Prefer email?
              </p>
              <p
                style={{
                  margin: "6px 0 0",
                  font: "400 13.5px/1.6 var(--mk-body)",
                  color: "var(--pw-text-secondary)",
                }}
              >
                Write to us at{" "}
                <a
                  href="mailto:support@pawdex.co"
                  style={{
                    color: "var(--pw-accent)",
                    textDecoration: "underline",
                    textUnderlineOffset: 2,
                  }}
                >
                  support@pawdex.co
                </a>
                . We read every message and reply within a few business days.
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
