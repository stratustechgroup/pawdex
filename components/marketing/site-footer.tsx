import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";

export function SiteFooter() {
  return (
    <footer className="mk-footer">
      <div
        className="mk-container"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "18px 32px",
        }}
      >
        <Wordmark size={20} />
        <span className="mk-small" style={{ fontSize: 12.5 }}>
          Your pets&apos; records, organized for life.
        </span>
        <div style={{ flex: 1 }} />
        <nav
          aria-label="Legal"
          style={{ display: "flex", flexWrap: "wrap", gap: "16px 20px" }}
        >
          <Link href="/privacy" className="mk-nav-link">
            Privacy
          </Link>
          <Link href="/terms" className="mk-nav-link">
            Terms
          </Link>
          <Link href="/accessibility" className="mk-nav-link">
            Accessibility
          </Link>
        </nav>
        <span className="mk-small" style={{ fontSize: 12.5, width: "100%" }}>
          Personal information is never sold or shared. Made with love in South
          Carolina · © {new Date().getFullYear()} Pawdex
        </span>
      </div>
    </footer>
  );
}
