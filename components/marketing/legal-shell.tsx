import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { ScrollRail } from "@/components/marketing/scroll-rail";
import { SiteFooter } from "@/components/marketing/site-footer";

// Shared frame for the long-form legal pages (privacy, terms, accessibility).
// Deliberately lighter than the marketing home header: its links go to real
// routes, not in-page anchors that only exist on the home page.
export type LegalSection = { id: string; label: string };

export function LegalShell({
  eyebrow,
  title,
  updated,
  sections,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  /** In-page contents. Every id must exist as an h2 id in the children. */
  sections?: LegalSection[];
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
      {/* A reading-position rail and a table of contents, and deliberately
          nothing else. These are documents people read under stress, often
          hunting one clause. Being able to jump straight to it, and to see how
          much is left, is worth more here than any amount of motion. */}
      {sections && sections.length > 0 ? (
        <ScrollRail chapters={sections} />
      ) : null}
      <main id="main">
        <article className="mk-legal">
          <p className="mk-legal-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="mk-legal-meta">{updated}</p>

          {sections && sections.length > 0 ? (
            <nav className="mk-legal-toc" aria-label="Contents">
              <p className="mk-legal-toc-head">Contents</p>
              <ol>
                {sections.map((sct) => (
                  <li key={sct.id}>
                    <a href={`#${sct.id}`}>{sct.label}</a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}

          {children}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
