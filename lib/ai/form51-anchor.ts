// NASPHV Form 51 (Rabies Vaccination Certificate) detector + extraction
// prompt-fragment helper.
//
// Form 51 is a legally significant document — animal-control authorities,
// boarding facilities, and travel regulators rely on the exact field values
// (next-due date, lot number, producer code, neuter status) to make
// regulatory decisions. The LLM extractor needs to be anchored on the fields
// that are most commonly miskeyed:
//
// - Tag # vs Serial/Lot # — sit side-by-side on the form, easy to swap
// - 1-Yr / 3-Yr / 4-Yr USDA Vaccine checkboxes — faded photocopies often
//   look like all three are checked
// - "Next Vaccination Due By" — vets routinely strike through the printed
//   date and write a corrected one in pen
// - Producer 3-letter code — a 3-char string that maps to a manufacturer
// - M/D/YY shorthand that gets re-keyed as M/D/YYYY (5/2/26 → 5/2/2006)
//
// The detector is intentionally regex-based and pure — it runs cheaply on
// every uploaded document's OCR text and only fires the heavier prompt
// fragment when signals cross a threshold.

export type Form51Detection = {
  is_form51: boolean;
  confidence: number; // [0, 1]
  matched_signals: string[];
};

type SignalCheck = {
  name: string;
  weight: number;
  test: (text: string) => boolean;
};

// Confidence threshold above which we consider the document to be Form 51.
// Tuned so that one strong signal alone is not enough — we want at least
// strong + medium, or two strongs, to flip the bit.
const DETECTION_THRESHOLD = 0.3;

// Producer codes appear on the form's Vaccination block as a 3-letter prefix
// adjacent to the "Producer" label or the product license number.
const PRODUCER_CODE_TOKENS = ["MER", "ZOE", "BIO", "MFR", "NOB", "VAN", "RAB"];

function hasProducerCodeNearLabel(text: string): boolean {
  // Look for "Producer" label and any of the canonical 3-letter codes within
  // 100 chars. We accept the codes either uppercase or in mixed case because
  // OCR sometimes lowercases them.
  const producerMatch = /\bProducer\b/i.exec(text);
  if (!producerMatch) return false;
  const start = Math.max(0, producerMatch.index - 100);
  const end = Math.min(text.length, producerMatch.index + 200);
  const window = text.slice(start, end);
  return PRODUCER_CODE_TOKENS.some((code) =>
    new RegExp(`\\b${code}\\b`).test(window),
  );
}

function allMatches(text: string, pattern: RegExp): Array<number> {
  // Collect every match index for a non-global pattern by recompiling with
  // /g. We need this to find the tightest cluster of "1 Yr" / "3 Yr" / "4 Yr"
  // tokens — the animal's "Age: 4 yr" field elsewhere on the form would
  // otherwise be picked first by a stateful exec() and pollute the span.
  const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  const indices: Array<number> = [];
  let m: RegExpExecArray | null;
  while ((m = global.exec(text)) !== null) {
    indices.push(m.index);
    if (m.index === global.lastIndex) global.lastIndex++; // avoid zero-width loop
  }
  return indices;
}

function hasYearCheckboxTriad(text: string): boolean {
  // The triad "1 Yr" / "3 Yr" / "4 Yr" sits inside the USDA vaccine duration
  // section, typically within ~30 chars of each other. Need at least two of
  // the three to appear within a 100-char window — and we scan ALL matches
  // because elsewhere on the form (e.g. "Age: 4 yr") can produce a stray hit
  // that ruins the proximity calc if we naively take the first.
  const ones = allMatches(text, /\b1\s*[- ]?\s*Yr\b/i);
  const threes = allMatches(text, /\b3\s*[- ]?\s*Yr\b/i);
  const fours = allMatches(text, /\b4\s*[- ]?\s*Yr\b/i);
  const groups = [ones, threes, fours].filter((g) => g.length > 0);
  if (groups.length < 2) return false;

  // For each pair of (or all three) match-sets, check whether there exists a
  // pick from each group that lies within a 100-char window.
  const PROXIMITY = 100;
  // Brute force over the cross product — match counts are tiny.
  function clusterFits(picks: Array<number>): boolean {
    return Math.max(...picks) - Math.min(...picks) <= PROXIMITY;
  }
  function search(gIdx: number, picks: Array<number>): boolean {
    if (gIdx === groups.length) return picks.length >= 2 && clusterFits(picks);
    for (const idx of groups[gIdx]) {
      if (search(gIdx + 1, [...picks, idx])) return true;
    }
    return false;
  }
  return search(0, []);
}

function hasInitialAndBoosterNearby(text: string): boolean {
  // Find any pair of "Initial" / "Booster" within 100 chars. Scan all matches
  // because long documents may have either word in unrelated context.
  const initials = allMatches(text, /\bInitial\b/i);
  const boosters = allMatches(text, /\bBooster\b/i);
  for (const i of initials) {
    for (const b of boosters) {
      if (Math.abs(i - b) <= 100) return true;
    }
  }
  return false;
}

const SIGNALS: Array<SignalCheck> = [
  // STRONG signals — 0.3 each
  {
    name: "nasphv_form_51_literal",
    weight: 0.3,
    test: (t) => /\bNASPHV\s*Form\s*#?\s*51\b/i.test(t) || /\bForm\s*#\s*51\b/i.test(t),
  },
  {
    name: "rabies_vaccination_certificate_title",
    weight: 0.3,
    test: (t) => /\bRabies\s+Vaccination\s+Certificate\b/i.test(t),
  },
  {
    name: "producer_code_near_label",
    weight: 0.3,
    test: hasProducerCodeNearLabel,
  },
  {
    name: "year_checkbox_triad",
    weight: 0.3,
    test: hasYearCheckboxTriad,
  },

  // MEDIUM signals — 0.15 each
  {
    name: "vaccine_serial_or_lot",
    weight: 0.15,
    test: (t) =>
      /\bVaccine\s+Serial\b/i.test(t) ||
      /\bSerial\s+No\.?\b/i.test(t) ||
      /\bLot\s+No\.?\b/i.test(t),
  },
  {
    name: "next_vaccination_due",
    weight: 0.15,
    test: (t) => /\bNext\s+Vaccination\s+Due\b/i.test(t),
  },
  {
    name: "initial_and_booster_nearby",
    weight: 0.15,
    test: hasInitialAndBoosterNearby,
  },
  {
    name: "usda_licensed",
    weight: 0.15,
    test: (t) => /\bUSDA\s+Licensed\b/i.test(t),
  },

  // WEAK signal — 0.05
  {
    name: "rabies_in_header",
    weight: 0.05,
    test: (t) => {
      // "Rabies" prominently — interpret as appearing within the first 200
      // chars of the sample (likely a header/title position).
      const head = t.slice(0, 200);
      return /\bRabies\b/i.test(head);
    },
  },
];

/**
 * Pure-function detector — takes a sample of extracted document text and
 * returns a Form 51 fingerprint score. Caller is expected to pass the first
 * ~2000 chars; we don't truncate here so tests can pass whole strings.
 */
export function detectForm51(textSample: string): Form51Detection {
  const text = textSample ?? "";
  if (!text.trim()) {
    return { is_form51: false, confidence: 0, matched_signals: [] };
  }

  let score = 0;
  const matched: Array<string> = [];

  for (const signal of SIGNALS) {
    if (signal.test(text)) {
      score += signal.weight;
      matched.push(signal.name);
    }
  }

  // Cap at 1.0 — the weights can sum above 1 if everything matches.
  const confidence = Math.min(1, score);

  return {
    is_form51: confidence >= DETECTION_THRESHOLD,
    confidence: Number(confidence.toFixed(2)),
    matched_signals: matched,
  };
}

/**
 * Prompt fragment to inject into the extraction prompt when Form 51 is
 * detected. Anchors the model on the legally-significant fields that are
 * most commonly miskeyed in production.
 */
export function form51PromptFragment(): string {
  return `
[FORM 51 — RABIES VACCINATION CERTIFICATE DETECTED]

This document is a NASPHV Form 51. Treat it as legally significant — vets,
boarders, and animal-control authorities rely on exact field values. Read
the form carefully and follow these rules:

1. TAG # vs SERIAL/LOT # — these are DIFFERENT fields that sit side-by-side
   on the form and are commonly confused. Tag # is the animal-control
   license number (short alphanumeric, often issued by the municipality).
   Serial/Lot # is the vaccine batch number (longer, often alphanumeric,
   printed on the vial). Capture each into its own field; never collapse
   them.

2. 1-YR / 3-YR / 4-YR USDA VACCINE CHECKBOXES — exactly one box should be
   checked indicating the duration of immunity. Examine the box carefully:
   if more than one box appears checked (which happens on faded photocopies
   where checkmarks bleed across boxes), DO NOT guess. Set
   ambiguous_dates=true and capture all checked-looking boxes in
   source_quote so a human can resolve it.

3. NEXT VACCINATION DUE BY — vets frequently strike through the printed
   date and handwrite a corrected one in pen. Capture the CORRECTED
   (handwritten) date in next_due_date, and include both the original and
   the correction verbatim in source_quote so the audit trail is preserved.

4. PRODUCER 3-LETTER CODE — capture the 3-character code VERBATIM (e.g.
   "MER", "ZOE", "BIO"). Common codes:
     MER → Merial / Boehringer-Ingelheim
     ZOE → Zoetis
     BIO → Bioveta
     MFR → Multiple / unknown manufacturer
     NOB → Nobivac (Merck)
     VAN → Vanguard (Zoetis)
     RAB → Rabvac (Elanco)
   Do not "translate" the code into the manufacturer name — preserve the
   3-letter form. Normalization happens downstream.

5. DATE FORMAT — vets routinely write dates in M/D/YY shorthand. If you see
   a 2-digit year, ASSUME 21st century. A "5/2/26" written for a 3-yr
   booster vaccinated in 2026 is 5/2/2029, never 5/2/2006. If you cannot
   determine the century with confidence, set the field's confidence below
   0.7 and explain in notes.

6. CONFIDENCE — because this certificate has legal weight, be conservative
   on confidence_overall. Flag any field you are unsure about rather than
   guessing. If even one of the vaccination-block fields is unreadable,
   set confidence_overall <= 0.6 and explain in notes.
`.trim();
}

/**
 * Producer-code normalization map. First-3-letter codes that appear on
 * Form 51 → full manufacturer name. Used by downstream normalization after
 * the LLM has captured the raw 3-letter token.
 *
 * Sources: USDA Center for Veterinary Biologics product license list +
 * NASPHV compendium of rabies prevention.
 */
export const PRODUCER_CODES: Record<string, string> = {
  MER: "Merial / Boehringer-Ingelheim",
  ZOE: "Zoetis",
  BIO: "Bioveta",
  MFR: "Multiple / Unknown",
  NOB: "Nobivac (Merck Animal Health)",
  VAN: "Vanguard (Zoetis)",
  RAB: "Rabvac (Elanco)",
  IMR: "Imrab (Merial / Boehringer-Ingelheim)",
  DEF: "Defensor (Zoetis)",
  PUR: "PureVax (Merial / Boehringer-Ingelheim)",
  CON: "Continuum (Boehringer-Ingelheim)",
  ELA: "Elanco Animal Health",
};
