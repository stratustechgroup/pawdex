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
        <span className="mk-small" style={{ fontSize: 12.5 }}>
          Personal information is never shared. Ever.
        </span>
        <span className="mk-small" style={{ fontSize: 12.5 }}>
          Made with love in South Carolina · © {new Date().getFullYear()} Pawdex
        </span>
      </div>
    </footer>
  );
}
