import { MkIcon } from "@/components/marketing/mk-icon";
import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { Icon } from "@/components/brand/icon";
import { ContactModalTrigger } from "@/components/marketing/contact-modal";

// Anchors route home-first ("/#id") so they work from any marketing route, not
// just the home page. Pricing and About are real pages. On the home page the
// anchors still resolve to same-page jumps.
//
// Travel and Breeders were dropped from the nav rather than repointed. Their
// content lived inside the life scene, the scene is gone, and a nav item that
// scrolls somewhere vaguely related is worse than one that is not there. Six
// items, all of which land on something real.
const LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#why-pawdex", label: "Why Pawdex" },
  { href: "/#pricing", label: "Pricing" },
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
        {/* Two labels, one link. Below 768px the full wording plus the menu
            button does not fit in 390px: making the button nowrap pushed the
            menu trigger clean off the screen, and letting it wrap put three
            lines of text inside a 38px pill. A shorter label at small widths is
            the only version where both controls fit and neither is mangled. */}
        <Link href="/#waitlist" className="mk-btn mk-header-cta">
          <span className="mk-cta-full">Get early access</span>
          <span className="mk-cta-short">Early access</span>
          <MkIcon name="arrowRight" size={14} />
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
