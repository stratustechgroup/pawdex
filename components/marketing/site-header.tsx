import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { Icon } from "@/components/brand/icon";

// Anchors route home-first ("/#id") so they work from any marketing route, not
// just the home page. Pricing is a real page. On the home page these still
// resolve to same-page jumps.
const LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#why-pawdex", label: "Why Pawdex" },
  { href: "/#breeders", label: "Breeders" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <header className="mk-header">
      <div className="mk-container mk-header-inner">
        <Link
          href="/"
          aria-label="Pawdex home"
          style={{ display: "inline-flex", textDecoration: "none", color: "var(--pw-text)" }}
        >
          <Wordmark size={22} />
        </Link>
        <nav className="mk-nav" aria-label="Primary">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="mk-nav-link">
              {l.label}
            </Link>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        <Link href="/#waitlist" className="mk-btn" style={{ height: 38, padding: "0 18px", fontSize: 13.5 }}>
          Get early access
          <Icon name="arrowRight" size={14} className="mk-btn-arrow" />
        </Link>
      </div>
    </header>
  );
}
