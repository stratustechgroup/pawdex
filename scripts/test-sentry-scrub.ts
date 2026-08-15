/**
 * Tests the Sentry event scrubbing in lib/observability/sentry-config.ts.
 *
 * This is a privacy control, not a nicety: Pawdex handles pet medical records
 * and owner contact details, and an error tracker that captures request bodies
 * or headers by default would ship exactly that to a third party. These asserts
 * are what stand between an exception and a data disclosure, so they run in the
 * normal `pnpm test` suite rather than as a one-off.
 *
 * Pure functions, no network, no DB.
 */
import { redact, scrubUrl, sharedOptions } from "../lib/observability/sentry-config";

let pass = 0;
let fail = 0;
function assert(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` (${detail})` : ""}`);
  if (ok) pass++;
  else fail++;
}

console.log("\n(1) redact() hides sensitive keys at any depth");
{
  const r = redact({
    authorization: "Bearer abc123",
    Cookie: "sb-access-token=xyz",
    email: "owner@example.com",
    nested: { password: "hunter2", phone: "555-0100", safe: "keep me" },
    list: [{ api_key: "sk-live-1" }, { fine: "ok" }],
    petName: "Luna",
  }) as Record<string, unknown>;

  assert("authorization redacted", r.authorization === "[redacted]");
  assert("Cookie redacted case-insensitively", r.Cookie === "[redacted]");
  assert("email redacted", r.email === "[redacted]");
  const nested = r.nested as Record<string, unknown>;
  assert("nested password redacted", nested.password === "[redacted]");
  assert("nested phone redacted", nested.phone === "[redacted]");
  assert("non-sensitive nested value kept", nested.safe === "keep me");
  const list = r.list as Record<string, unknown>[];
  assert("redacts inside arrays", list[0].api_key === "[redacted]");
  assert("keeps benign array values", list[1].fine === "ok");
  assert("keeps non-sensitive top-level value", r.petName === "Luna");
}

console.log("\n(2) redact() is depth-capped and total-safe");
{
  let deep: Record<string, unknown> = { password: "leaf" };
  for (let i = 0; i < 20; i++) deep = { level: deep };
  const out: unknown = redact(deep);
  assert("deep nesting does not throw", true);
  assert("returns an object", typeof out === "object" && out !== null);
  assert("primitives pass through", redact("plain") === "plain");
  assert("null passes through", redact(null) === null);
}

console.log("\n(3) scrubUrl() strips query strings and tokens");
{
  assert(
    "query string dropped (magic-link token_hash)",
    scrubUrl("https://www.pawdex.co/auth/callback?token_hash=abc&type=magiclink") ===
      "/auth/callback",
  );
  assert("share token replaced", scrubUrl("https://www.pawdex.co/share/SEKRET") === "/share/[token]");
  assert(
    "transfer token replaced",
    scrubUrl("https://www.pawdex.co/transfer/SEKRET") === "/transfer/[token]",
  );
  assert("invite token replaced", scrubUrl("https://www.pawdex.co/invite/SEKRET") === "/invite/[token]");
  assert(
    "unsubscribe token replaced",
    scrubUrl("https://www.pawdex.co/api/unsubscribe/SEKRET") === "/api/unsubscribe/[token]",
  );
  assert("ordinary path kept", scrubUrl("https://www.pawdex.co/pricing") === "/pricing");
  assert("undefined passes through", scrubUrl(undefined) === undefined);
  assert("garbage does not throw", typeof scrubUrl("://:::") === "string");
}

console.log("\n(4) beforeSend strips the high-risk event fields");
{
  const event = {
    request: {
      data: { note: "Luna had a seizure on the 4th" },
      cookies: { "sb-access-token": "xyz" },
      url: "https://www.pawdex.co/share/SEKRET?x=1",
      headers: { authorization: "Bearer abc", "user-agent": "test" },
      query_string: "token_hash=abc",
    },
    user: { id: "user-uuid", email: "owner@example.com" },
    extra: { password: "hunter2", count: 3 },
    contexts: { custom: { email: "owner@example.com" } },
  };

  const out = sharedOptions.beforeSend(structuredClone(event)) as typeof event;

  assert("request body removed", out.request.data === undefined);
  assert("cookies removed", out.request.cookies === undefined);
  assert("url scrubbed to token-free prefix", out.request.url === "/share/[token]");
  assert(
    "auth header redacted",
    (out.request.headers as Record<string, unknown>).authorization === "[redacted]",
  );
  assert(
    "benign header kept",
    (out.request.headers as Record<string, unknown>)["user-agent"] === "test",
  );
  assert("query string redacted", out.request.query_string === "[redacted]");
  assert("user object removed entirely", out.user === undefined);
  assert("extra redacted", (out.extra as Record<string, unknown>).password === "[redacted]");
  assert("benign extra kept", (out.extra as Record<string, unknown>).count === 3);
  assert(
    "contexts redacted",
    ((out.contexts as Record<string, unknown>).custom as Record<string, unknown>).email ===
      "[redacted]",
  );
}

console.log("\n(5) ships inert without a DSN");
{
  assert(
    "dsn empty unless configured",
    process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
      ? true
      : sharedOptions.dsn === "",
    `dsn="${sharedOptions.dsn}"`,
  );
  assert("PII sending disabled", sharedOptions.sendDefaultPii === false);
  assert("tracing off by default", sharedOptions.tracesSampleRate === 0);
}

console.log(`\nsentry scrub: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
