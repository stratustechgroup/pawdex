import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Household invitations: we generate a 32-byte random token and store ONLY
// its sha256 hash. The raw token leaves the server exactly once (in the
// invite email's URL) and can't be recovered from the DB after.

const TOKEN_BYTES = 32;

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function generateInvitationToken(): { raw: string; hash: string } {
  const raw = base64url(randomBytes(TOKEN_BYTES));
  const hash = hashToken(raw);
  return { raw, hash };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function tokensMatch(rawCandidate: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashToken(rawCandidate), "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

export function invitationExpiry(daysFromNow = 7): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d;
}
