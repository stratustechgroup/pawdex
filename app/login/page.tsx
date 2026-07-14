import Link from "next/link";

import { PawdexMark } from "@/components/brand/mark";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in · Pawdex",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  const sent = params.sent === "1";
  const redirectTo = params.redirect ?? "/";

  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        background: "var(--pw-bg)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "var(--pw-text)",
            textDecoration: "none",
            marginBottom: 28,
          }}
        >
          <PawdexMark size={26} color="var(--pw-accent)" />
          <span
            style={{
              font: "600 17px var(--font-inter)",
              letterSpacing: "-0.01em",
            }}
          >
            Pawdex
          </span>
        </Link>

        <h1
          className="serif"
          style={{
            margin: 0,
            font: "500 28px var(--font-source-serif)",
            letterSpacing: "-0.02em",
            color: "var(--pw-text)",
          }}
        >
          Welcome back.
        </h1>
        <p
          style={{
            margin: "8px 0 24px",
            font: "400 13.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          Sign in to keep your pets&apos; records organized.
        </p>

        {sent ? (
          <div
            className="pw-card"
            style={{
              padding: 20,
              textAlign: "left",
              font: "400 13px var(--font-inter)",
            }}
          >
            <p
              style={{
                margin: 0,
                font: "500 14px var(--font-inter)",
                color: "var(--pw-text)",
              }}
            >
              Check your email
            </p>
            <p style={{ margin: "6px 0 0", color: "var(--pw-text-muted)" }}>
              We sent a magic link. It expires in 10 minutes.
            </p>
          </div>
        ) : (
          <LoginForm redirectTo={redirectTo} />
        )}

        {params.error && !sent && (
          <p
            style={{
              marginTop: 12,
              font: "400 12.5px var(--font-inter)",
              color: "var(--pw-status-overdue-fg)",
            }}
          >
            {params.error}
          </p>
        )}

        <p
          style={{
            marginTop: 28,
            font: "400 12px var(--font-inter)",
            color: "var(--pw-text-muted)",
            lineHeight: 1.55,
          }}
        >
          By signing in, you confirm you are 18 or older and agree to Pawdex&rsquo;s{" "}
          <a href="/terms" style={{ color: "var(--pw-accent)", textDecoration: "underline" }}>
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" style={{ color: "var(--pw-accent)", textDecoration: "underline" }}>
            Privacy Policy
          </a>
          , and authorize Pawdex to send transactional emails on your behalf only
          with your explicit per-feature consent. Pawdex is offered in the United States
          and is not directed to the EEA or UK.
        </p>
      </div>
    </main>
  );
}
