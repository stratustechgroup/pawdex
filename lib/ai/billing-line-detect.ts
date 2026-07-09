// Heuristics that flag extracted medical_event rows that look like invoice
// billing lines rather than clinical events. Used by the review form to
// default-skip suspicious rows and surface a warning — the user can override.

// Strong signals — title looks unambiguously like a billing line. Always skip.
const STRONG_PATTERNS: Array<RegExp> = [
  /\b(hazardous|biohazard|medical)\s+waste\b/i,
  /\bwaste\s+disposal\b/i,
  /\bdisposal\s+fee\b/i,
  /\bdispensing\s+fee\b/i,
  /\bcompounding\s+fee\b/i,
  /\bhandling\s+fee\b/i,
  /\bauthorization\s+fee\b/i,
  /\brefill\s+(request\s+)?fee\b/i,
  /\bafter[\s-]?hours\s+(fee|surcharge|charge)\b/i,
  /\bemergency\s+surcharge\b/i,
  /\bfacility\s+fee\b/i,
  /\brecordkeeping\s+fee\b/i,
  /\bdocumentation\s+fee\b/i,
  /\bofficial\s+document\s+fee\b/i,
  /\bsales\s+tax\b/i,
  /^tax$/i,
  /\bdiscount\b/i,
  /\badjustment\b/i,
  /\bprevious\s+balance\b/i,
  /\bstatement\s+balance\b/i,
  /\bpayment\s+received\b/i,
  /\bcredit\s+applied\b/i,
  /^office\s+(visit|call)$/i,
  /\banesthesia\s+monitoring\b/i,
  /\bboarding\s+(fee|night|day|charge)\b/i,
  /^kennel\b/i,
  /^daycare\b/i,
  /\bgrooming\s+(fee|charge)\b/i,
  /\bbath\s+(fee|charge|service)\b/i,
  /\bnail\s+trim\s+(fee|charge)\b/i,
];

// Soft signal — generic "X fee" pattern. We don't reject outright, just warn:
// some procedures legitimately use "fee" in their name ("dental prophy fee
// includes anesthesia and polishing"), so we leave the user to decide.
const SOFT_GENERIC_FEE = /\bfee\b/i;

export type BillingLineMatch =
  | { kind: "strong"; reason: string }
  | { kind: "soft"; reason: string }
  | { kind: "none" };

export function detectBillingLine(title: string): BillingLineMatch {
  const t = (title ?? "").trim();
  if (!t) return { kind: "none" };

  for (const p of STRONG_PATTERNS) {
    if (p.test(t)) {
      return {
        kind: "strong",
        reason: "Looks like a billing fee, not a clinical event.",
      };
    }
  }

  if (SOFT_GENERIC_FEE.test(t)) {
    return {
      kind: "soft",
      reason: "Title contains “fee” — double-check this is a clinical event.",
    };
  }

  return { kind: "none" };
}

export function isLikelyBillingLine(title: string): boolean {
  return detectBillingLine(title).kind === "strong";
}
