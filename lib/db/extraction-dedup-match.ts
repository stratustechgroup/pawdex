/**
 * Pure entity-dedup matchers — NO I/O, NO database, NO side effects.
 *
 * Split out of extraction-dedup.ts so the matching logic can be unit-tested
 * with synthetic rows (no Supabase, no API keys). The DB-fetching wrappers in
 * extraction-dedup.ts fetch the existing rows + clinic names, then delegate
 * the actual matching here.
 *
 * Every matcher returns Map<candidateIndex, Match[]> — the candidate's
 * position in the input array maps to the existing rows that look like the
 * same real-world thing. Matches carry a `match_strength`:
 *   - "exact"  : almost certainly the same record (same family + same day,
 *                or identical drug name + same start date). The review UI
 *                DEFAULTS the skip-toggle ON for these.
 *   - "strong" : very likely the same (same family within window, high token
 *                overlap). Also default-skipped.
 *   - "loose"  : plausibly related but the user should look (type-substring
 *                only, minimum token overlap). Surfaced but NOT default-skipped.
 *
 * Pawdex never auto-deletes — these are advisory. "Default skip" means the
 * row is still rendered and the user can flip it back on. A false-positive
 * match must never silently vanish a real dose.
 */

export type MatchStrength = "exact" | "strong" | "loose";

/** True when this strength should pre-set the review skip-toggle to ON. */
export function isHighConfidence(s: MatchStrength): boolean {
  return s === "exact" || s === "strong";
}

// ── shared helpers (mirrors extraction-dedup.ts originals) ──────────

const STOPWORDS = new Set([
  "the",
  "of",
  "for",
  "and",
  "or",
  "to",
  "with",
  "a",
  "an",
  "in",
  "on",
  "at",
  "by",
  "exam",
  "examination",
  "visit",
  "office",
  "annual",
  "wellness",
  "check",
  "checkup",
  "consult",
  "consultation",
  "vet",
  "veterinary",
  "test",
]);

export function tokens(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

export function daysAbs(a: string, b: string): number {
  const ma = Date.parse(a);
  const mb = Date.parse(b);
  if (!Number.isFinite(ma) || !Number.isFinite(mb))
    return Number.POSITIVE_INFINITY;
  return Math.abs(ma - mb) / 86_400_000;
}

export function normalizeMedName(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/\([^)]*\)/g, " ") // strip parenthetical asides
      // Strip dose strengths BEFORE collapsing punctuation so decimals
      // ("16.5 mg", "0.5 mg/ml") are caught. Vet PIMS exports routinely embed
      // the strength in the drug NAME ("Apoquel 16mg tablet") while putting
      // the dose in a separate column — without this, the same drug fails to
      // match itself across documents and we silently re-ingest a duplicate.
      .replace(
        /\b\d+(\.\d+)?\s*(mcg|mg|kg|ug|iu|ml|g|units?|%)(\s*\/\s*(ml|kg|tab|dose))?\b/g,
        " ",
      )
      .replace(/[^a-z0-9]+/g, " ")
      .replace(
        /\b(oral|injectable|inj|tab|tablet|capsule|caps|chewable|chew|liquid|solution|suspension|po|sc|sq|iv|im)\b/g,
        " ",
      )
      .trim()
      .replace(/\s+/g, " ")
  );
}

// ── vaccines ────────────────────────────────────────────────────────

export type VaccineCandidate = {
  vaccine_family: string | null;
  vaccine_type: string;
  administered_on: string;
};

export type ExistingVaccine = {
  id: string;
  vaccine_type: string;
  vaccine_family: string | null;
  administered_on: string;
  expires_on: string | null;
  vet_clinic_id: string | null;
  vet_clinic_name: string | null;
  document_id: string | null;
};

export type VaccineMatch = ExistingVaccine & {
  days_apart: number;
  match_strength: MatchStrength;
};

export const VACCINE_DATE_WINDOW_DAYS = 3;

// Two independent family-inference implementations exist: the TS
// inferFamilyFromType (vaccine-catalog.ts, used on extraction candidates) and
// the SQL vaccine_family_of() generated column (migration 0005, stamped on
// stored rows). They mostly agree, but not everywhere — SQL emits
// 'canine_influenza' where TS emits 'civ'. Without canonicalization the
// family compare silently fails for every CIV vaccine and the dedup
// default-skip never fires. Canonicalize BOTH sides through this alias map
// before comparing. Add entries here whenever the two implementations
// diverge.
const FAMILY_ALIASES: Record<string, string> = {
  canine_influenza: "civ",
};

export function canonicalFamily(
  family: string | null | undefined,
): string | null {
  if (!family) return null;
  const k = family.toLowerCase().trim();
  return FAMILY_ALIASES[k] ?? k;
}

export function matchVaccines(
  candidates: VaccineCandidate[],
  existing: ExistingVaccine[],
): Map<number, VaccineMatch[]> {
  const out = new Map<number, VaccineMatch[]>();

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const matches: VaccineMatch[] = [];

    for (const e of existing) {
      const dist = daysAbs(c.administered_on, e.administered_on);
      if (dist > VACCINE_DATE_WINDOW_DAYS) continue;

      const cFam = canonicalFamily(c.vaccine_family);
      const eFam = canonicalFamily(e.vaccine_family);
      const familyMatch = !!cFam && !!eFam && cFam === eFam;
      const typeMatch =
        c.vaccine_type.toLowerCase().includes(e.vaccine_type.toLowerCase()) ||
        e.vaccine_type.toLowerCase().includes(c.vaccine_type.toLowerCase());

      if (!familyMatch && !typeMatch) continue;

      // Strength: same family + same calendar day → exact. Same family within
      // window → strong. Type-substring only → loose (user should review).
      let strength: MatchStrength;
      if (familyMatch && dist < 1) strength = "exact";
      else if (familyMatch) strength = "strong";
      else strength = "loose";

      matches.push({ ...e, days_apart: dist, match_strength: strength });
    }

    if (matches.length > 0) {
      matches.sort(
        (a, b) =>
          strengthRank(a.match_strength) - strengthRank(b.match_strength) ||
          a.days_apart - b.days_apart,
      );
      out.set(i, matches);
    }
  }
  return out;
}

// ── medical events ──────────────────────────────────────────────────

export type MedicalEventCandidate = {
  occurred_on: string;
  title: string;
  event_type: string;
};

export type ExistingMedicalEvent = {
  id: string;
  event_type: string;
  title: string;
  occurred_on: string;
  vet_clinic_id: string | null;
  vet_clinic_name: string | null;
  document_id: string | null;
};

export type MedicalEventMatch = ExistingMedicalEvent & {
  days_apart: number;
  token_overlap: string[];
  match_strength: MatchStrength;
};

export const EVENT_DATE_WINDOW_DAYS = 1;
export const MIN_TITLE_TOKEN_OVERLAP = 2;

export function matchMedicalEvents(
  candidates: MedicalEventCandidate[],
  existing: ExistingMedicalEvent[],
): Map<number, MedicalEventMatch[]> {
  const out = new Map<number, MedicalEventMatch[]>();

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const candTokens = new Set(tokens(c.title));
    if (candTokens.size === 0) continue;

    const matches: MedicalEventMatch[] = [];
    for (const e of existing) {
      const dist = daysAbs(c.occurred_on, e.occurred_on);
      if (dist > EVENT_DATE_WINDOW_DAYS) continue;

      const existingTokens = new Set(tokens(e.title));
      const overlap: string[] = [];
      for (const t of candTokens) {
        if (existingTokens.has(t)) overlap.push(t);
      }
      if (overlap.length < MIN_TITLE_TOKEN_OVERLAP) continue;

      // Strength: same day + ≥3 shared tokens → exact. Same day + 2 tokens, or
      // ≥3 tokens within window → strong. Otherwise loose.
      let strength: MatchStrength;
      if (dist < 1 && overlap.length >= 3) strength = "exact";
      else if ((dist < 1 && overlap.length >= 2) || overlap.length >= 3)
        strength = "strong";
      else strength = "loose";

      matches.push({
        ...e,
        days_apart: dist,
        token_overlap: overlap,
        match_strength: strength,
      });
    }

    if (matches.length > 0) {
      matches.sort(
        (a, b) =>
          strengthRank(a.match_strength) - strengthRank(b.match_strength) ||
          b.token_overlap.length - a.token_overlap.length ||
          a.days_apart - b.days_apart,
      );
      out.set(i, matches);
    }
  }
  return out;
}

// ── medications ─────────────────────────────────────────────────────

export type MedicationCandidate = {
  name: string;
  generic_name: string | null;
  started_on: string | null;
};

export type ExistingMedication = {
  id: string;
  name: string;
  generic_name: string | null;
  dose: string;
  frequency: string | null;
  started_on: string;
  ended_on: string | null;
  medication_context: string;
};

export type MedicationMatch = ExistingMedication & {
  days_apart: number;
  match_strength: MatchStrength;
};

export const MED_DATE_WINDOW_DAYS = 3;

export function matchMedications(
  candidates: MedicationCandidate[],
  existing: ExistingMedication[],
): Map<number, MedicationMatch[]> {
  const out = new Map<number, MedicationMatch[]>();

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const candNames = new Set(
      [
        normalizeMedName(c.name),
        c.generic_name ? normalizeMedName(c.generic_name) : "",
      ].filter(Boolean),
    );

    const matches: MedicationMatch[] = [];
    for (const e of existing) {
      const existingNames = new Set(
        [
          normalizeMedName(e.name),
          e.generic_name ? normalizeMedName(e.generic_name) : "",
        ].filter(Boolean),
      );

      let nameOverlap = false;
      for (const n of candNames) {
        if (existingNames.has(n)) {
          nameOverlap = true;
          break;
        }
      }
      if (!nameOverlap) continue;

      const hasDate = !!c.started_on;
      const dist = hasDate ? daysAbs(c.started_on as string, e.started_on) : 0;
      if (hasDate && dist > MED_DATE_WINDOW_DAYS) continue;

      // Strength: a name match corroborated by a DATE is high-confidence and
      // default-skips (same day → exact, within window → strong). A name match
      // with NO date on the candidate can't be confirmed as the same course vs
      // a genuinely-new course of the same drug — so it's "loose": still
      // surfaced with a banner, but never pre-skipped. This keeps a new course
      // of a known drug from being silently hidden when the document omits the
      // start date (common in PIMS current-meds summary blocks).
      let strength: MatchStrength;
      if (!hasDate) strength = "loose";
      else if (dist < 1) strength = "exact";
      else strength = "strong";

      matches.push({ ...e, days_apart: dist, match_strength: strength });
    }

    if (matches.length > 0) {
      matches.sort(
        (a, b) =>
          strengthRank(a.match_strength) - strengthRank(b.match_strength) ||
          a.days_apart - b.days_apart,
      );
      out.set(i, matches);
    }
  }
  return out;
}

// ── weights ─────────────────────────────────────────────────────────
//
// Weights only dedup within the SAME calendar day — a pet is weighed at most
// once per visit, and day-to-day fluctuation is real signal we must keep.
// Two tiers only: near-identical reading → exact (pre-skip); same-day but
// diverging reading → loose (surfaced, never pre-skipped — it may be a
// legitimate re-measurement or a corrected entry).

export type WeightCandidate = {
  recorded_on: string;
  weight_kg: number | null;
};

export type ExistingWeight = {
  id: string;
  recorded_on: string;
  weight_kg: number;
  document_id: string | null;
};

export type WeightMatch = ExistingWeight & {
  kg_delta: number | null;
  match_strength: MatchStrength;
};

export const WEIGHT_EXACT_KG_TOLERANCE = 0.05;

export function matchWeights(
  candidates: WeightCandidate[],
  existing: ExistingWeight[],
): Map<number, WeightMatch[]> {
  const out = new Map<number, WeightMatch[]>();

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (!c.recorded_on) continue;

    const matches: WeightMatch[] = [];
    for (const e of existing) {
      if (daysAbs(c.recorded_on, e.recorded_on) >= 1) continue;

      const delta =
        c.weight_kg !== null && Number.isFinite(c.weight_kg)
          ? Math.abs(c.weight_kg - e.weight_kg)
          : null;
      const strength: MatchStrength =
        delta !== null && delta <= WEIGHT_EXACT_KG_TOLERANCE
          ? "exact"
          : "loose";

      matches.push({ ...e, kg_delta: delta, match_strength: strength });
    }

    if (matches.length > 0) {
      matches.sort(
        (a, b) =>
          strengthRank(a.match_strength) - strengthRank(b.match_strength) ||
          (a.kg_delta ?? Infinity) - (b.kg_delta ?? Infinity),
      );
      out.set(i, matches);
    }
  }
  return out;
}

// ── lab values ──────────────────────────────────────────────────────
//
// A lab row duplicates when the SAME analyte was already stored for the SAME
// collection date. Equal value → exact (pre-skip: it's the same panel
// re-ingested). Differing value → loose only — a same-day different value can
// be a corrected/amended result, and pre-skipping would hide the correction.

export type LabValueCandidate = {
  analyte: string;
  collected_on: string;
  value: number | null;
};

export type ExistingLabValue = {
  id: string;
  analyte: string;
  value: number | null;
  units: string | null;
  collected_on: string;
  document_id: string | null;
};

export type LabValueMatch = ExistingLabValue & {
  match_strength: MatchStrength;
};

export function normalizeAnalyte(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function matchLabValues(
  candidates: LabValueCandidate[],
  existing: ExistingLabValue[],
): Map<number, LabValueMatch[]> {
  const out = new Map<number, LabValueMatch[]>();

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const cAnalyte = normalizeAnalyte(c.analyte);
    if (!cAnalyte || !c.collected_on) continue;

    const matches: LabValueMatch[] = [];
    for (const e of existing) {
      if (normalizeAnalyte(e.analyte) !== cAnalyte) continue;
      if (daysAbs(c.collected_on, e.collected_on) >= 1) continue;

      const sameValue =
        c.value !== null &&
        e.value !== null &&
        Math.abs(c.value - e.value) < 1e-9;
      matches.push({
        ...e,
        match_strength: sameValue ? "exact" : "loose",
      });
    }

    if (matches.length > 0) {
      matches.sort(
        (a, b) =>
          strengthRank(a.match_strength) - strengthRank(b.match_strength),
      );
      out.set(i, matches);
    }
  }
  return out;
}

// ── internal ────────────────────────────────────────────────────────

function strengthRank(s: MatchStrength): number {
  switch (s) {
    case "exact":
      return 0;
    case "strong":
      return 1;
    case "loose":
      return 2;
  }
}
