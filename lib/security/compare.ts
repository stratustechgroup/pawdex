import { createHash, timingSafeEqual } from "node:crypto";

// Constant-time string comparison for secret checks (cron Bearer tokens).
// Hashing first equalizes lengths so timingSafeEqual never throws and the
// comparison leaks nothing about where the mismatch occurs.
export function secretsEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}
