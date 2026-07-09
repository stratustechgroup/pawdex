/**
 * Pre-existing-condition (PEC) signal-phrase pre-filter.
 *
 * Scans raw pet-insurance policy text BEFORE handing it to the LLM, tags
 * spans (sentence-sized clauses) that contain PEC-relevant language, and
 * provides a best-guess category for each so the LLM can classify or
 * correct the hint.
 *
 * Why a pre-filter? Naive matching on "pre-existing" or "excluded" creates
 * false positives — for example, Embrace/Fetch/Lemonade have curable-
 * condition-reinstatement language that LOOKS like a permanent exclusion
 * but actually un-excludes a condition after a symptom-free window. By
 * tagging spans and labeling them with a phrase-based hint, we narrow the
 * LLM's job to classification (much cheaper than reading the whole policy
 * cold) and reduce ambiguity-driven errors.
 */

export type PecClauseCategory =
  | "permanent" // condition is excluded forever once manifested
  | "curable-with-waiting" // un-excluded after N symptom-free months (180/365 days is common)
  | "bilateral-extension" // an issue on one knee/eye/etc. extends to the other side
  | "symptom-only" // exclusion triggers on noted symptoms not formal diagnosis
  | "lookback-window" // pre-policy clean-window definition (e.g. 12 months prior)
  | "definition" // just defines what "pre-existing" means without invoking
  | "ambiguous"; // signal phrase matched but classification unclear

export type PecTaggedSpan = {
  text: string; // the matched span, verbatim from input
  start: number; // character offset in the full policy text
  end: number; // character offset (exclusive)
  matched_phrases: string[]; // which signal phrases triggered this span
  category_hint: PecClauseCategory; // best-guess category from phrase patterns
};

// ---------------------------------------------------------------------------
// Signal phrase definitions
// ---------------------------------------------------------------------------
//
// Each entry is { label, regex, category }. The label is the human-readable
// phrase reported back to the LLM in matched_phrases; the regex is what we
// actually scan with. Most are simple case-insensitive substrings; a few
// use [\s\S]{0,N} bounded gaps to enforce proximity rules without
// over-matching across paragraph boundaries.
//
// IMPORTANT: regexes are tested per-sentence (not against the full text), so
// gap-quantifiers like [\s\S]{0,40} are safe — they cannot run away across
// the whole document.

type SignalPhrase = {
  label: string;
  regex: RegExp;
  category: PecClauseCategory;
};

const SIGNAL_PHRASES: SignalPhrase[] = [
  // --- permanent -----------------------------------------------------------
  { label: "permanently excluded", regex: /permanently\s+excluded/i, category: "permanent" },
  { label: "will not be covered", regex: /will\s+not\s+be\s+covered/i, category: "permanent" },
  {
    label: "is not covered at any time",
    regex: /is\s+not\s+covered\s+at\s+any\s+time/i,
    category: "permanent",
  },
  { label: "lifetime exclusion", regex: /lifetime\s+exclusion/i, category: "permanent" },
  { label: "permanently ineligible", regex: /permanently\s+ineligible/i, category: "permanent" },

  // --- curable-with-waiting -----------------------------------------------
  {
    label: "may be eligible for coverage after",
    regex: /may\s+be\s+eligible\s+for\s+coverage\s+after/i,
    category: "curable-with-waiting",
  },
  {
    label: "symptom-free for N months/days",
    // matches "symptom-free for 180 days", "symptom free for 12 months", etc.
    regex: /symptom[-\s]?free\s+for\s+\d+\s+(?:months?|days?)/i,
    category: "curable-with-waiting",
  },
  {
    label: "N days/months symptom-free",
    // matches "180 days symptom-free", "12 months symptom free"
    regex: /\d+\s+(?:days?|months?)\s+symptom[-\s]?free/i,
    category: "curable-with-waiting",
  },
  {
    label: "no clinical signs for N months/days",
    regex: /no\s+clinical\s+signs\s+for\s+\d+\s+(?:months?|days?)/i,
    category: "curable-with-waiting",
  },
  { label: "curable condition", regex: /curable\s+condition/i, category: "curable-with-waiting" },
  {
    label: "if treated and resolved",
    regex: /if\s+treated\s+and\s+resolved/i,
    category: "curable-with-waiting",
  },

  // --- bilateral-extension -------------------------------------------------
  { label: "bilateral condition", regex: /bilateral\s+condition/i, category: "bilateral-extension" },
  { label: "bilateral exclusion", regex: /bilateral\s+exclusion/i, category: "bilateral-extension" },
  { label: "contralateral", regex: /contralateral/i, category: "bilateral-extension" },
  {
    label: "the other side (knee/eye/ear/hip/joint)",
    // "the other side" within ~40 chars of an anatomical pair word
    regex:
      /(?:the\s+other\s+side[\s\S]{0,40}(?:knee|eye|ear|hip|joint)|(?:knee|eye|ear|hip|joint)[\s\S]{0,40}the\s+other\s+side)/i,
    category: "bilateral-extension",
  },
  {
    label: "the other knee/eye/ear/hip",
    // covers "if one knee is affected, the other knee is also..."
    regex: /the\s+other\s+(?:knee|eye|ear|hip|joint)/i,
    category: "bilateral-extension",
  },
  {
    label: "cranial cruciate ligament + either/both",
    regex:
      /(?:cranial\s+cruciate\s+ligament[\s\S]{0,80}(?:either|both)|(?:either|both)[\s\S]{0,80}cranial\s+cruciate\s+ligament)/i,
    category: "bilateral-extension",
  },
  {
    label: "cranial cruciate ligament (paired)",
    // bare CCL mention near a pairing word — caught above, but also flag
    // a bare CCL mention inside a sentence that ALSO mentions "bilateral"
    // or "other knee" (which the per-sentence accumulator will join with
    // other matches).
    regex: /cranial\s+cruciate\s+ligament/i,
    category: "bilateral-extension",
  },

  // --- symptom-only --------------------------------------------------------
  {
    label: "manifestation of clinical signs",
    regex: /manifestation\s+of\s+clinical\s+signs/i,
    category: "symptom-only",
  },
  { label: "showed signs", regex: /showed\s+signs/i, category: "symptom-only" },
  { label: "symptoms noted", regex: /symptoms\s+noted/i, category: "symptom-only" },
  {
    label: "noted in the medical records",
    regex: /noted\s+in\s+the\s+medical\s+records/i,
    category: "symptom-only",
  },
  { label: "indication of", regex: /indication\s+of/i, category: "symptom-only" },
  { label: "consistent with", regex: /consistent\s+with/i, category: "symptom-only" },

  // --- lookback-window -----------------------------------------------------
  { label: "look-back period", regex: /look[-\s]?back\s+period/i, category: "lookback-window" },
  {
    label: "during the N-month period prior to",
    regex: /during\s+the\s+\d+[-\s]?month\s+period\s+prior\s+to/i,
    category: "lookback-window",
  },
  {
    label: "N months/days before the effective date",
    regex: /\d+\s+(?:months?|days?)\s+before\s+the\s+(?:policy\s+)?effective\s+date/i,
    category: "lookback-window",
  },
  {
    label: "N months/days preceding",
    regex: /\d+\s+(?:months?|days?)\s+preceding/i,
    category: "lookback-window",
  },
  {
    label: "N months prior to coverage",
    // covers "12 months prior to coverage" — the sample text uses this exact form
    regex: /\d+\s+(?:months?|days?)\s+prior\s+to\s+(?:coverage|the\s+policy|the\s+effective)/i,
    category: "lookback-window",
  },
  { label: "policy effective date", regex: /policy\s+effective\s+date/i, category: "lookback-window" },
  { label: "waiting period", regex: /waiting\s+period/i, category: "lookback-window" },

  // --- definition ----------------------------------------------------------
  {
    label: "pre-existing condition means",
    regex: /pre[-\s]?existing\s+condition\s+(?:is|means)/i,
    category: "definition",
  },
  {
    label: "for the purposes of this policy",
    regex: /for\s+the\s+purposes\s+of\s+this\s+policy/i,
    category: "definition",
  },
  {
    label: "the term 'pre-existing'",
    regex: /the\s+term\s+['"]?pre[-\s]?existing/i,
    category: "definition",
  },
];

// Category priority — when a sentence matches multiple categories we pick the
// "most actionable" one. Curable-with-waiting wins over everything because
// missing it is the false-positive failure mode the whole pre-filter exists
// to prevent. The order follows the spec:
// curable-with-waiting > bilateral-extension > lookback-window > symptom-only
// > permanent > definition.
const CATEGORY_PRIORITY: Record<PecClauseCategory, number> = {
  "curable-with-waiting": 6,
  "bilateral-extension": 5,
  "lookback-window": 4,
  "symptom-only": 3,
  permanent: 2,
  definition: 1,
  ambiguous: 0,
};

function pickCategory(cats: PecClauseCategory[]): PecClauseCategory {
  if (cats.length === 0) return "ambiguous";
  return cats.reduce((best, c) =>
    CATEGORY_PRIORITY[c] > CATEGORY_PRIORITY[best] ? c : best,
  );
}

// ---------------------------------------------------------------------------
// Sentence splitting
// ---------------------------------------------------------------------------
//
// We split on sentence-ending punctuation (.!?) followed by whitespace, while
// preserving exact character offsets in the original string. Cap the
// effective sentence length at 400 chars per the spec — policy clauses can
// run paragraph-length.

const MAX_SPAN_CHARS = 400;

type Sentence = { text: string; start: number; end: number };

function splitSentences(text: string): Sentence[] {
  const sentences: Sentence[] = [];
  // Match the END of a sentence: one of .!? followed by whitespace.
  const boundary = /[.!?]\s+/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = boundary.exec(text)) !== null) {
    const end = m.index + 1; // include the punctuation char
    const raw = text.slice(cursor, end);
    // Trim leading whitespace but preserve true offsets
    const leading = raw.length - raw.trimStart().length;
    const trimmedText = raw.trim();
    if (trimmedText.length > 0) {
      sentences.push({
        text: trimmedText,
        start: cursor + leading,
        end: cursor + leading + trimmedText.length,
      });
    }
    cursor = m.index + m[0].length;
  }
  // Tail (after last boundary, or whole string if none)
  if (cursor < text.length) {
    const raw = text.slice(cursor);
    const leading = raw.length - raw.trimStart().length;
    const trimmedText = raw.trim();
    if (trimmedText.length > 0) {
      sentences.push({
        text: trimmedText,
        start: cursor + leading,
        end: cursor + leading + trimmedText.length,
      });
    }
  }
  return sentences;
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Scan policy text and return all spans containing PEC-relevant language.
 * Spans are character ranges — each starts at the beginning of a sentence
 * containing a signal phrase and extends to the end of that sentence
 * (or up to 400 chars, whichever is shorter).
 *
 * Adjacent overlapping spans (within 50 chars) are merged.
 * Returns spans in order of appearance.
 */
export function tagPecSpans(policyText: string): PecTaggedSpan[] {
  if (!policyText || policyText.length === 0) return [];

  const sentences = splitSentences(policyText);
  const raw: PecTaggedSpan[] = [];

  for (const sent of sentences) {
    const hay = sent.text;
    const matched: string[] = [];
    const cats: PecClauseCategory[] = [];

    for (const phrase of SIGNAL_PHRASES) {
      if (phrase.regex.test(hay)) {
        matched.push(phrase.label);
        cats.push(phrase.category);
      }
    }

    if (matched.length === 0) continue;

    // Cap span at MAX_SPAN_CHARS
    let end = sent.end;
    if (end - sent.start > MAX_SPAN_CHARS) {
      end = sent.start + MAX_SPAN_CHARS;
    }
    const text = policyText.slice(sent.start, end);

    raw.push({
      text,
      start: sent.start,
      end,
      matched_phrases: matched,
      category_hint: pickCategory(cats),
    });
  }

  return mergeAdjacent(raw, policyText);
}

// Merge overlapping or near-adjacent spans.
//
// The spec allows merging when "span A ends within 50 chars of span B's
// start," but applying that literally to per-sentence spans collapses every
// consecutive sentence in a PEC-heavy paragraph into a single mega-span,
// which destroys the per-clause classification the LLM needs.
//
// In practice this merge only fires when two spans actually overlap (or are
// separated by pure whitespace, e.g. a midsentence fragment match). Because
// the per-sentence loop already emits one span per sentence, separate
// sentences — which are delimited by a sentence-ending punctuation char +
// whitespace — never overlap, so they stay as separate spans. The merge is
// still useful if a future change produces multiple sub-sentence spans from
// the same sentence (e.g. regex-anchored windows).
//
// Needs policyText so it can re-slice the `text` field after extending end.
function mergeAdjacent(spans: PecTaggedSpan[], policyText: string): PecTaggedSpan[] {
  if (spans.length <= 1) return spans;
  const out: PecTaggedSpan[] = [];
  let current: PecTaggedSpan = {
    ...spans[0],
    matched_phrases: [...spans[0].matched_phrases],
  };

  for (let i = 1; i < spans.length; i++) {
    const next = spans[i];
    // Merge only when truly overlapping. Per-sentence spans are separated by
    // sentence-terminating punctuation + whitespace, so they are NOT merged
    // here even though they may be only a few chars apart.
    if (next.start < current.end) {
      const merged_phrases = Array.from(
        new Set([...current.matched_phrases, ...next.matched_phrases]),
      );
      const cats: PecClauseCategory[] = [];
      for (const label of merged_phrases) {
        const phrase = SIGNAL_PHRASES.find((p) => p.label === label);
        if (phrase) cats.push(phrase.category);
      }
      // Cap the merged span at MAX_SPAN_CHARS measured from the merged start.
      const newEnd = Math.min(next.end, current.start + MAX_SPAN_CHARS);
      current = {
        text: policyText.slice(current.start, newEnd),
        start: current.start,
        end: newEnd,
        matched_phrases: merged_phrases,
        category_hint: pickCategory(cats),
      };
    } else {
      out.push(current);
      current = { ...next, matched_phrases: [...next.matched_phrases] };
    }
  }
  out.push(current);

  return out;
}

// ---------------------------------------------------------------------------
// Prompt fragment
// ---------------------------------------------------------------------------

const CATEGORY_DEFINITIONS: Record<PecClauseCategory, string> = {
  permanent: "Condition is excluded forever once it manifests. No reinstatement.",
  "curable-with-waiting":
    "Condition can be re-covered after a symptom-free window (often 180 or 365 days). The most commonly mis-classified category — do NOT label this as 'permanent'.",
  "bilateral-extension":
    "A diagnosis on one side of a paired body part (knee/eye/ear/hip) extends the exclusion to the other side.",
  "symptom-only":
    "Exclusion triggers on noted symptoms in the medical record, not on a formal diagnosis.",
  "lookback-window":
    "Defines the pre-policy clean window — e.g. 'no signs in the 12 months prior to the effective date.'",
  definition:
    "Defines what 'pre-existing condition' means in this policy without invoking an exclusion.",
  ambiguous: "Signal phrase matched but the surrounding context is unclear.",
};

/**
 * Render a prompt fragment to inject into the policy-extraction LLM call.
 * Includes the tagged spans, each labeled with its category_hint, and
 * instructs the model to classify each into the canonical PecClauseCategory
 * (or refine the hint if wrong).
 */
export function pecPromptFragment(spans: PecTaggedSpan[]): string {
  if (spans.length === 0) {
    return [
      "## Pre-existing-condition (PEC) language pre-scan",
      "",
      "The pre-filter found no PEC signal phrases in this policy text.",
      "Do NOT invent PEC clauses. If you believe the policy contains PEC",
      "language that the pre-filter missed, flag it separately with a note.",
    ].join("\n");
  }

  const header = [
    "## Pre-existing-condition (PEC) language pre-scan",
    "",
    "The pre-filter tagged the following spans as containing PEC-relevant",
    "language. For each span, confirm the category_hint or replace it with",
    "the correct PecClauseCategory. The canonical categories and their",
    "meanings are:",
    "",
  ];

  for (const [cat, def] of Object.entries(CATEGORY_DEFINITIONS) as [
    PecClauseCategory,
    string,
  ][]) {
    header.push(`- **${cat}**: ${def}`);
  }

  header.push(
    "",
    "**Critical:** clauses that LOOK like permanent exclusions but actually",
    "un-exclude a condition after a symptom-free window (e.g. 'symptom-free",
    "for 180 days', 'may be eligible for coverage after', 'curable condition')",
    "must be tagged `curable-with-waiting`, NOT `permanent`. Several",
    "well-known carriers (Embrace, Fetch, Lemonade) use this pattern.",
    "",
    "### Tagged spans",
    "",
  );

  const body = spans.map((span, i) => {
    const phrases = span.matched_phrases.map((p) => `\`${p}\``).join(", ");
    return [
      `**Span ${i + 1}** (chars ${span.start}–${span.end})`,
      `- matched phrases: ${phrases}`,
      `- category_hint: \`${span.category_hint}\``,
      `- text:`,
      "  > " + span.text.replace(/\n/g, "\n  > "),
    ].join("\n");
  });

  const footer = [
    "",
    "### Output format",
    "",
    "For each span above, output JSON of the form:",
    "```json",
    '{ "span_index": 1, "final_category": "curable-with-waiting", "rationale": "..." }',
    "```",
  ];

  return [...header, ...body, ...footer].join("\n");
}

