import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { Icon } from "@/components/brand/icon";
import { ContactModalTrigger } from "@/components/marketing/contact-modal";

// Anchors route home-first ("/#id") so they work from any marketing route, not
// just the home page. Pricing and About are real pages. On the home page the
// anchors still resolve to same-page jumps.
const LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#why-pawdex", label: "Why Pawdex" },
  { href: "/#travel", label: "Travel" },
  { href: "/#breeders", label: "Breeders" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
  { href: "/about", label: "About" },
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
          {/* Opens the shared contact modal; renders as a nav-link trigger. */}
          <ContactModalTrigger label="Contact" />
        </nav>
        <div style={{ flex: 1 }} />
        <Link href="/#waitlist" className="mk-btn" style={{ height: 38, padding: "0 18px", fontSize: 13.5 }}>
          Get early access
          <Icon name="arrowRight" size={14} className="mk-btn-arrow" />
        </Link>

        {/*
          Mobile menu. Below 768px .mk-nav is display:none and only the CTA
          survived, so Pricing, About and every section anchor were reachable
          only via the footer — a navigation dead end on the first page a
          prospect sees (docs/mobile-audit.md, ranked #6).

          Built on <details>/<summary> rather than a client component: this
          header is a server component, and the native disclosure gives
          keyboard support, Escape-to-close and correct expanded/collapsed
          semantics to assistive tech for free. No JS, no hydration.
        */}
        <details className="mk-mobile-menu">
          <summary className="mk-mobile-menu-trigger" aria-label="Menu">
            <Icon name="menu" size={18} />
          </summary>
          <nav className="mk-mobile-menu-panel" aria-label="Primary (mobile)">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="mk-mobile-menu-link">
                {l.label}
              </Link>
            ))}
            <ContactModalTrigger label="Contact" />
          </nav>
        </details>
      </div>
    </header>
  );
}
