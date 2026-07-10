import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { SiteFooter } from "@/components/marketing/site-footer";

// Shared frame for the long-form legal pages (privacy, terms, accessibility).
// Deliberately lighter than the marketing home header: its links go to real
// routes, not in-page anchors that only exist on the home page.
export function LegalShell({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div id="top">
      <a href="#main" className="mk-skip">
        Skip to content
      </a>
      <header className="mk-header">
        <div className="mk-container mk-header-inner">
          <Link
            href="/"
            aria-label="Pawdex home"
            style={{
              display: "inline-flex",
              textDecoration: "none",
              color: "var(--pw-text)",
            }}
          >
            <Wordmark size={22} />
          </Link>
          <div style={{ flex: 1 }} />
          <Link
            href="/"
            className="mk-nav-link"
            style={{ textDecoration: "none" }}
          >
            Back to home
          </Link>
        </div>
      </header>
      <main id="main">
        <article className="mk-legal">
          <p className="mk-legal-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="mk-legal-meta">{updated}</p>
          {children}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
