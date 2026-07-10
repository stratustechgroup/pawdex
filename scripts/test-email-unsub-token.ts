/**
 * Behavioral test for the reminder unsubscribe token round-trip.
 *
 * Run:  pnpm dlx tsx scripts/test-email-unsub-token.ts
 *
 * The token is generated inside the Deno edge function
 * (supabase/functions/reminders-cron/index.ts :: signUnsubToken) and verified
 * inside the Next.js app (lib/reminders/unsubscribe-token.ts). They must agree
 * byte-for-byte AND the token must survive sitting in a URL *path* segment
 * (/api/unsubscribe/<token>).
 *
 * The bug this guards against: the Deno side used to emit STANDARD base64
 * (btoa), which contains `/` and `+`. The HMAC still round-trips (the verifier
 * hashes the literal string it receives, and its base64url decode is lenient),
 * so a "does verify() accept it?" test FALSE-PASSES. The real defect is
 * transport: a `/` in the token splits the path and the [token] segment never
 * matches, so the link 404s. This test therefore asserts on the CHARACTER SET,
 * not just acceptance, and demonstrates the old encoding breaking to prove the
 * discriminating check actually discriminates.
 *
 * No framework. check(cond,msg) + counters; nonzero exit on any failure.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Load .env.local so REMINDER_UNSUBSCRIBE_SECRET is present before we import
// the verifier (which reads the secret lazily, at call time).
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const env = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // fall through - env may already be set by the caller
}

if (!process.env.REMINDER_UNSUBSCRIBE_SECRET) {
  console.error("REMINDER_UNSUBSCRIBE_SECRET not set (checked env + .env.local)");
  process.exit(2);
}

const SECRET = process.env.REMINDER_UNSUBSCRIBE_SECRET;

import {
  verifyUnsubscribeToken,
  signUnsubscribeToken,
} from "../lib/reminders/unsubscribe-token";

// ── tiny harness ────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];
function check(cond: boolean, msg: string): void {
  if (cond) passed++;
  else {
    failed++;
    failures.push(msg);
    console.error("FAIL:", msg);
  }
}

// ── faithful reproductions of the Deno signer, both variants ─────────
// These mirror the edge function exactly (btoa + crypto.subtle HMAC). The
// only difference is the base64 alphabet, which is the whole point.
async function denoSign(
  householdId: string,
  urlSafe: boolean,
): Promise<string> {
  const payloadJson = JSON.stringify({ h: householdId, t: Date.now() });
  const strip = (s: string) => s.replace(/=+$/, "");
  const urlify = (s: string) => s.replace(/\+/g, "-").replace(/\//g, "_");
  const enc = (s: string) => (urlSafe ? urlify(strip(s)) : strip(s));

  const payloadB64 = enc(btoa(payloadJson));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64),
  );
  const sigB64 = enc(btoa(String.fromCharCode(...new Uint8Array(sig))));
  return `${payloadB64}.${sigB64}`;
}

const URL_SAFE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function randomUuid(): string {
  return crypto.randomUUID();
}

async function main() {
  const N = 1000;
  const households = Array.from({ length: N }, randomUuid);

  // ── The FIXED Deno signer (matches what we just shipped) ───────────
  let fixedUrlSafe = 0;
  let fixedVerified = 0;
  let fixedCorrectId = 0;
  for (const h of households) {
    const token = await denoSign(h, /* urlSafe */ true);
    if (URL_SAFE.test(token)) fixedUrlSafe++;
    const payload = verifyUnsubscribeToken(token);
    if (payload) {
      fixedVerified++;
      if (payload.householdId === h) fixedCorrectId++;
    }
  }
  check(fixedUrlSafe === N, `fixed signer: all ${N} tokens URL-path-safe (got ${fixedUrlSafe})`);
  check(fixedVerified === N, `fixed signer: all ${N} tokens verify (got ${fixedVerified})`);
  check(fixedCorrectId === N, `fixed signer: all ${N} recover correct householdId (got ${fixedCorrectId})`);

  // ── The OLD (buggy) Deno signer - demonstrate the defect ───────────
  // The discriminating fact: verify() still accepts ~all of them, but a large
  // fraction are NOT path-safe. That split is the proof the bug was routing,
  // not crypto.
  let oldUrlSafe = 0;
  let oldVerified = 0;
  let oldHadSlash = 0;
  for (const h of households) {
    const token = await denoSign(h, /* urlSafe */ false);
    if (URL_SAFE.test(token)) oldUrlSafe++;
    if (token.includes("/")) oldHadSlash++;
    if (verifyUnsubscribeToken(token)) oldVerified++;
  }
  // The old encoding should verify essentially always (crypto round-trips)...
  check(
    oldVerified >= N * 0.99,
    `old signer: verify() still accepts it (crypto round-trips) - got ${oldVerified}/${N}`,
  );
  // ...but the MAJORITY are not URL-path-safe (contain `/` or `+`), and a large
  // fraction carry a hard-breaking `/` specifically. That is the whole defect.
  const oldPathUnsafe = N - oldUrlSafe;
  check(
    oldPathUnsafe > N * 0.5,
    `old signer: majority NOT path-safe - got ${oldPathUnsafe}/${N} (${((oldPathUnsafe / N) * 100).toFixed(0)}%) contain / or +`,
  );
  check(
    oldHadSlash > N * 0.3,
    `old signer: large fraction carry a path-breaking '/' - got ${oldHadSlash}/${N} (${((oldHadSlash / N) * 100).toFixed(0)}%)`,
  );

  // ── Node-side self round-trip (signUnsubscribeToken → verify) ──────
  {
    const h = randomUuid();
    const token = signUnsubscribeToken(h);
    check(URL_SAFE.test(token), "node signer: token is URL-path-safe");
    const p = verifyUnsubscribeToken(token);
    check(!!p && p.householdId === h, "node signer: round-trips to correct householdId");
  }

  // ── Forgery resistance ─────────────────────────────────────────────
  {
    const h = randomUuid();
    const token = await denoSign(h, true);
    const [payloadB64, sigB64] = token.split(".");

    // tampered signature. Flip the FIRST base64 char - the trailing char of a
    // 32-byte signature has 2 "don't-care" low bits, so flipping it can decode
    // to identical bytes; the first char is always fully significant.
    const flipped =
      (sigB64[0] === "A" ? "Z" : "A") + sigB64.slice(1);
    check(
      verifyUnsubscribeToken(`${payloadB64}.${flipped}`) === null,
      "forgery: tampered signature rejected",
    );

    // tampered payload (attacker swaps in another household id, keeps old sig)
    const evilPayload = btoa(JSON.stringify({ h: randomUuid(), t: Date.now() }))
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    check(
      verifyUnsubscribeToken(`${evilPayload}.${sigB64}`) === null,
      "forgery: payload swap with stale signature rejected",
    );

    // garbage
    check(verifyUnsubscribeToken("not-a-token") === null, "forgery: garbage rejected");
    check(verifyUnsubscribeToken("") === null, "forgery: empty rejected");
    check(verifyUnsubscribeToken(".") === null, "forgery: lone dot rejected");

    // signature made with a different secret must fail
    const otherKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("a-totally-different-secret-value-32bytes!!"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const otherSig = await crypto.subtle.sign(
      "HMAC",
      otherKey,
      new TextEncoder().encode(payloadB64),
    );
    const otherSigB64 = btoa(String.fromCharCode(...new Uint8Array(otherSig)))
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    check(
      verifyUnsubscribeToken(`${payloadB64}.${otherSigB64}`) === null,
      "forgery: signature from wrong secret rejected",
    );
  }

  console.log(
    `\nunsub-token: ${passed} passed, ${failed} failed` +
      `\n  fixed signer:  url-safe=${fixedUrlSafe}/${N} verified=${fixedVerified}/${N}` +
      `\n  old signer:    url-safe=${oldUrlSafe}/${N} slash-broken=${oldHadSlash}/${N} verified=${oldVerified}/${N}`,
  );
  if (failed > 0) {
    console.error("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n"));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
