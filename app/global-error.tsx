"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Last-resort boundary for errors thrown in the root layout or during client
// render, where no other error.tsx can catch them. Next replaces the entire
// document here, so this file supplies its own <html>/<body> and cannot rely on
// the fonts, CSS variables, or theme class the root layout sets up. Hence the
// inline styles and the system font stack: the one screen that must never
// itself fail to render.
//
// Reports to Sentry (no-op until a DSN is configured) so a render crash stops
// being invisible.

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "#0f1210",
          color: "#e8e6e1",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <main style={{ maxWidth: 460, textAlign: "center" }}>
          <h1 style={{ font: "600 20px/1.3 inherit", margin: "0 0 10px" }}>
            Something went wrong
          </h1>
          <p
            style={{
              font: "400 14.5px/1.6 inherit",
              margin: "0 0 22px",
              color: "#a8a49c",
            }}
          >
            An unexpected error stopped this page from loading. Your records are
            safe and nothing was changed. Reloading usually clears it.
          </p>
          <a
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 44,
              padding: "0 20px",
              borderRadius: 8,
              background: "#2f7a5a",
              color: "#ffffff",
              textDecoration: "none",
              font: "500 14.5px inherit",
            }}
          >
            Reload Pawdex
          </a>
          {error.digest ? (
            <p
              style={{
                font: "400 12px/1.5 inherit",
                marginTop: 22,
                color: "#726e67",
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
