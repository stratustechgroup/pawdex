import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";

type FooterLink = { href: string; label: string };

const PRODUCT: FooterLink[] = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#why-pawdex", label: "Why Pawdex" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#breeders", label: "Breeders" },
  { href: "/#faq", label: "FAQ" },
];

const COMPANY: FooterLink[] = [
  { href: "/about", label: "About" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/contact", label: "Contact" },
];

const LEGAL: FooterLink[] = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function SiteFooter() {
  return (
    <footer className="mk-footer">
      <div
        className="mk-container"
        style={{ display: "flex", flexDirection: "column", gap: 36 }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "36px 32px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              flex: "1 1 240px",
              minWidth: 0,
            }}
          >
            <Wordmark size={22} />
            <p
              className="mk-small"
              style={{ margin: 0, fontSize: 13, maxWidth: 260, lineHeight: 1.55 }}
            >
              Every vet record, one timeline, for the life of your pet.
            </p>
            <p
              className="mk-mono-tag"
              style={{ margin: 0, color: "var(--pw-text-muted)" }}
            >
              Made with love in South Carolina
            </p>
          </div>

          <FooterColumn heading="Product" links={PRODUCT} />
          <FooterColumn heading="Company" links={COMPANY} />
          <FooterColumn heading="Legal" links={LEGAL} />
        </div>

        <div className="mk-hairline" />

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px 24px",
          }}
        >
          <span className="mk-small" style={{ fontSize: 12.5 }}>
            © {new Date().getFullYear()} Pawdex
          </span>
          <span className="mk-small" style={{ fontSize: 12.5 }}>
            Personal information is never sold or shared.
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  heading,
  links,
}: {
  heading: string;
  links: FooterLink[];
}) {
  return (
    <nav aria-label={heading} style={{ display: "flex", flexDirection: "column", gap: 10, flex: "1 1 120px", minWidth: 0 }}>
      <span
        style={{
          font: "600 11px var(--mk-mono)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--pw-text-muted)",
        }}
      >
        {heading}
      </span>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="mk-nav-link" style={{ fontSize: 13.5 }}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
