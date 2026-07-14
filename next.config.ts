import type { NextConfig } from "next";

// CSP ships report-only until it has soaked against real traffic; the other
// headers are enforced. Inline styles are load-bearing across the app, and
// scripts have no nonce plumbing yet, so both keep 'unsafe-inline'. Dev needs
// 'unsafe-eval' for react-refresh.
const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com${
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
  }`,
  "connect-src 'self' https://*.supabase.co https://va.vercel-scripts.com",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), payment=()",
          },
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
