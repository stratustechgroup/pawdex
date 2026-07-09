import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Tokens have shape `{base64url-payload}.{base64url-hmac}`. Payload is a JSON
// object `{ h: householdId, t: issuedAtMs }`. Matches the Deno function's
// signUnsubToken so emails sent there round-trip back here.

function base64urlEncode(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return b.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64urlDecode(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Buffer.from(padded, "base64");
}

function getSecret(): string {
  const s = process.env.REMINDER_UNSUBSCRIBE_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "REMINDER_UNSUBSCRIBE_SECRET is missing or too short — set a 64-char hex string.",
    );
  }
  return s;
}

export function signUnsubscribeToken(householdId: string): string {
  const payload = JSON.stringify({ h: householdId, t: Date.now() });
  const payloadB64 = base64urlEncode(payload);
  const sig = createHmac("sha256", getSecret()).update(payloadB64).digest();
  return `${payloadB64}.${base64urlEncode(sig)}`;
}

export type UnsubscribePayload = { householdId: string; issuedAt: number };

export function verifyUnsubscribeToken(token: string): UnsubscribePayload | null {
  if (!token || typeof token !== "string") return null;
  const idx = token.lastIndexOf(".");
  if (idx <= 0) return null;
  const payloadB64 = token.slice(0, idx);
  const sigB64 = token.slice(idx + 1);

  try {
    const expected = createHmac("sha256", getSecret()).update(payloadB64).digest();
    const provided = base64urlDecode(sigB64);
    if (provided.length !== expected.length) return null;
    if (!timingSafeEqual(provided, expected)) return null;

    const payloadJson = base64urlDecode(payloadB64).toString("utf8");
    const parsed = JSON.parse(payloadJson) as { h?: unknown; t?: unknown };
    if (typeof parsed.h !== "string" || typeof parsed.t !== "number") return null;
    return { householdId: parsed.h, issuedAt: parsed.t };
  } catch {
    return null;
  }
}
