import { Wordmark } from "@/components/brand/wordmark";
import { Icon } from "@/components/brand/icon";

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#why-pawdex", label: "Why Pawdex" },
  { href: "#breeders", label: "Breeders" },
  { href: "#faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <header className="mk-header">
      <div className="mk-container mk-header-inner">
        <a
          href="#top"
          aria-label="Pawdex home"
          style={{ display: "inline-flex", textDecoration: "none", color: "var(--pw-text)" }}
        >
          <Wordmark size={22} />
        </a>
        <nav className="mk-nav" aria-label="Page sections">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="mk-nav-link">
              {l.label}
            </a>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        <a href="#waitlist" className="mk-btn" style={{ height: 38, padding: "0 18px", fontSize: 13.5 }}>
          Get early access
          <Icon name="arrowRight" size={14} className="mk-btn-arrow" />
        </a>
      </div>
    </header>
  );
}
