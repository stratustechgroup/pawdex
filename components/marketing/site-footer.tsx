import { Wordmark } from "@/components/brand/wordmark";

export function SiteFooter() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--pw-border)",
        background: "var(--pw-surface)",
      }}
    >
      <div
        className="mk-container mk-footer"
        style={{
          paddingBlock: 40,
          display: "flex",
          gap: 20,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ maxWidth: 360 }}>
          <Wordmark size={21} />
          <p
            style={{
              margin: "12px 0 0",
              font: "400 12.5px/1.6 var(--font-inter)",
              color: "var(--pw-text-muted)",
            }}
          >
            Every vet record, one timeline, for life. Your pets&apos; personal
            information is never shared or sold.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            font: "400 12.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          <a
            href="#waitlist"
            style={{ color: "var(--pw-text-secondary)", textDecoration: "none" }}
          >
            Join the waitlist
          </a>
          <a
            href="mailto:realalecfarmer@gmail.com"
            style={{ color: "var(--pw-text-secondary)", textDecoration: "none" }}
          >
            realalecfarmer@gmail.com
          </a>
          <span style={{ color: "var(--pw-text-subtle)" }}>
            © {new Date().getFullYear()} Pawdex
          </span>
        </div>
      </div>
    </footer>
  );
}
