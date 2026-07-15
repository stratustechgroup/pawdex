import { PURCHASABLE_PLANS } from "@/lib/billing/plans";

/**
 * Schema.org structured data for the marketing surface (SEO + AEO).
 *
 * Each builder returns a standalone JSON-LD object (it carries its own
 * "@context") so the integration pass can drop a single schema into a page
 * without any wrapping graph. Types are kept loose (Record<string, unknown>)
 * on purpose: schema.org shapes are wide and evolve, and a strict interface
 * would create churn for zero runtime benefit.
 *
 * Server component. No "use client": these render to static markup.
 */

const BASE = "https://www.pawdex.co";
const CONTEXT = "https://schema.org";

const ORG_DESCRIPTION =
  "Pawdex turns any veterinary document into a structured, portable, searchable pet medical record.";

const APP_DESCRIPTION =
  "Forward or snap any vet document and Pawdex turns it into a structured, source-cited medical history: reminders, insurance analysis, multi-user households, AI Q&A over your records, EU travel packets, and adoption transfer.";

/**
 * Renders a JSON-LD script tag. This is the one safe, standard use of
 * dangerouslySetInnerHTML: the payload is our own schema.org object, never
 * user input. The "<" escape defends against a "</script>" breakout if a
 * value ever contains angle brackets.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export function organizationSchema(): Record<string, unknown> {
  return {
    "@context": CONTEXT,
    "@type": "Organization",
    name: "Pawdex",
    url: BASE,
    description: ORG_DESCRIPTION,
  };
}

export function webSiteSchema(): Record<string, unknown> {
  return {
    "@context": CONTEXT,
    "@type": "WebSite",
    name: "Pawdex",
    url: BASE,
  };
}

export function softwareApplicationSchema(): Record<string, unknown> {
  const offers = PURCHASABLE_PLANS.map((plan) => ({
    "@type": "Offer",
    name: plan.name,
    price: (plan.priceMonthlyCents / 100).toFixed(2),
    priceCurrency: "USD",
  }));

  return {
    "@context": CONTEXT,
    "@type": "SoftwareApplication",
    name: "Pawdex",
    applicationCategory: "HealthApplication",
    operatingSystem: "Web",
    url: BASE,
    description: APP_DESCRIPTION,
    offers,
  };
}

export function faqPageSchema(
  faqs: { q: string; a: string }[],
): Record<string, unknown> {
  return {
    "@context": CONTEXT,
    "@type": "FAQPage",
    mainEntity: faqs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: {
        "@type": "Answer",
        text: a,
      },
    })),
  };
}

export function aboutPageSchema(): Record<string, unknown> {
  return {
    "@context": CONTEXT,
    "@type": "AboutPage",
    name: "About Pawdex",
    url: `${BASE}/about`,
    description: ORG_DESCRIPTION,
  };
}

export function contactPageSchema(): Record<string, unknown> {
  return {
    "@context": CONTEXT,
    "@type": "ContactPage",
    name: "Contact Pawdex",
    url: `${BASE}/contact`,
    description: "How to reach the Pawdex team for support and questions.",
  };
}
