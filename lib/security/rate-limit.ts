// Best-effort, in-process sliding-window rate limiter for token-guessing
// surfaces (/share, /transfer, /invite, unsubscribe). Fluid Compute reuses
// function instances, so this map survives across requests on a warm
// instance; it is NOT distributed and resets on cold start. That is
// acceptable: the tokens are 192-bit so brute force is infeasible regardless.
// This only throttles noisy scanners as defense in depth (SECURITY.md items
// 1-2). Swap for a Redis/Edge Config limiter if traffic ever justifies it.

const WINDOW_MS = 60_000;
const MAX_MAP_SIZE = 10_000;

const hits = new Map<string, number[]>();

export function isRateLimited(
  key: string,
  limit: number,
  windowMs: number = WINDOW_MS,
): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;

  // Opportunistic cleanup so the map can't grow unbounded under a
  // many-source scan; drops the oldest half when the cap is hit.
  if (hits.size > MAX_MAP_SIZE) {
    let dropped = 0;
    for (const k of hits.keys()) {
      hits.delete(k);
      if (++dropped >= MAX_MAP_SIZE / 2) break;
    }
  }

  const timestamps = (hits.get(key) ?? []).filter((t) => t > cutoff);
  if (timestamps.length >= limit) {
    hits.set(key, timestamps);
    return true;
  }
  timestamps.push(now);
  hits.set(key, timestamps);
  return false;
}
