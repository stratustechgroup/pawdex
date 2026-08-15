/**
 * Shared Sentry configuration.
 *
 * Everything here is inert until SENTRY_DSN (or NEXT_PUBLIC_SENTRY_DSN for the
 * browser) is set in the environment. `Sentry.init` with an empty DSN is a
 * documented no-op, so the app behaves identically with the key absent — which
 * is how it ships until the account exists.
 *
 * PRIVACY
 * Pawdex handles pet medical records and owner contact details. An error
 * tracker that helpfully captures request bodies and local variables would
 * exfiltrate exactly that into a third-party system, and the privacy policy
 * does not list an error-tracking subprocessor. So this config is deliberately
 * conservative: no PII, no request bodies, and a scrubber that drops the
 * fields most likely to carry personal data before an event leaves the process.
 *
 * Add Sentry to the subprocessor list in docs/gdpr-posture.md and the privacy
 * policy before enabling the DSN in production.
 */

/** Fields whose values never leave the process, matched case-insensitively. */
const SENSITIVE_KEYS = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-supabase-auth",
  "apikey",
  "api_key",
  "password",
  "token",
  "token_hash",
  "secret",
  "email",
  "phone",
  "address",
  "microchip",
  "dob",
  "date_of_birth",
];

function isSensitive(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_KEYS.some((s) => k.includes(s));
}

/** Recursively redact sensitive-looking keys. Depth-capped to bound the work. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isSensitive(k) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}

/**
 * Strip query strings from URLs. A magic-link callback carries `token_hash` in
 * the query, and a share/transfer/invite link carries its token in the path —
 * so paths are truncated to their prefix for those routes rather than sent raw.
 */
export function scrubUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url, "https://placeholder.invalid");
    const tokenRoutes = ["/share/", "/transfer/", "/invite/", "/api/unsubscribe/"];
    for (const prefix of tokenRoutes) {
      if (u.pathname.startsWith(prefix)) return `${prefix}[token]`;
    }
    return u.pathname;
  } catch {
    return "[unparseable]";
  }
}

type SentryErrorEvent = {
  request?: {
    data?: unknown;
    cookies?: unknown;
    url?: string;
    headers?: unknown;
    query_string?: unknown;
  };
  user?: unknown;
  extra?: unknown;
  contexts?: unknown;
};

export const sharedOptions = {
  // Absent DSN => init is a no-op. Ships safe before the account exists.
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? "",
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  // Never attach IP addresses, cookies, or user identifiers automatically.
  sendDefaultPii: false,
  // Error tracking is the goal; performance tracing is opt-in later. Zero
  // sample rate keeps volume (and cost) at the free tier while still
  // capturing every exception.
  tracesSampleRate: 0,
  // Typed loosely on purpose: Sentry's ErrorEvent shape differs slightly
  // between the browser, node and edge builds, and this scrubbing only touches
  // fields common to all three. The cast at the call site keeps each SDK happy
  // without duplicating the function per runtime.
  beforeSend<T>(event: T): T {
    const e = event as SentryErrorEvent;
    if (e.request) {
      delete e.request.data; // request body — never send
      delete e.request.cookies;
      e.request.url = scrubUrl(e.request.url);
      if (e.request.headers) e.request.headers = redact(e.request.headers);
      if (e.request.query_string) e.request.query_string = "[redacted]";
    }
    delete e.user;
    if (e.extra) e.extra = redact(e.extra);
    if (e.contexts) e.contexts = redact(e.contexts);
    return event;
  },
};
