// PIMS (Practice Information Management System) document classifier.
//
// Given the first ~3000 characters of extracted text from a vet PDF, identify
// which PIMS produced it so the extraction prompt can route into format-
// specific guidance. Each PIMS leaves distinctive fingerprints in the rendered
// document — product names in headers/footers, characteristic table column
// orderings, code patterns, and layout artifacts from browser-based printing.
//
// The classifier is a pure function: it counts matched signals per family and
// returns the highest-scoring one. Ties broken by signal count, then by the
// declared family priority below (more specific PIMS before generic fallback).
//
// Confidence calibration:
//   0 signals  → unknown,           conf 0
//   1 signal   → tentative match,   conf 0.4
//   2 signals  → confident match,   conf 0.7
//   3 signals  → strong match,      conf 0.85
//   4+ signals → very strong match, conf 0.95

export type PimsFamily =
  | "cornerstone" // IDEXX Cornerstone
  | "avimark" // Covetrus AVImark
  | "evetpractice" // Covetrus eVetPractice
  | "ezyvet" // IDEXX ezyVet
  | "soap_export" // Generic SOAP export — not from a known PIMS
  | "unknown";

export type PimsSignals = {
  family: PimsFamily;
  confidence: number; // [0, 1]
  matched_signals: string[];
};

type SignalRule = {
  /** Short, human-readable description that flows into the prompt addendum. */
  label: string;
  /** Case-insensitive matcher applied to the text sample. */
  pattern: RegExp;
};

// ---------------------------------------------------------------------------
// Signal rules per family.
// ---------------------------------------------------------------------------

const CORNERSTONE_SIGNALS: SignalRule[] = [
  // Product/vendor markings.
  { label: "Cornerstone product name", pattern: /\bcornerstone\b/i },
  { label: "IDEXX Cornerstone vendor mark", pattern: /idexx[^\n]{0,40}cornerstone/i },
  // Section headings Cornerstone prints in its medical record exports.
  { label: '"Medical Notes" section heading', pattern: /\bmedical\s+notes\b/i },
  { label: '"Patient Visit List" heading', pattern: /\bpatient\s+visit\s+list\b/i },
  { label: '"Patient History" heading', pattern: /\bpatient\s+history\b/i,
  },
  // Patient signalment banner — Cornerstone repeats this on every page.
  {
    label: "Repeated patient signalment banner",
    pattern: /(patient\s*(id|#|:)|client\s*(id|#|:))[\s\S]{0,80}(species|breed|sex|dob|date\s+of\s+birth)/i,
  },
  // Common Cornerstone form-letter footer / report header.
  { label: "Cornerstone report header", pattern: /cornerstone\s+(practice|software|report)/i },
];

const AVIMARK_SIGNALS: SignalRule[] = [
  // Vendor markings — AVImark is owned by Covetrus and was historically
  // published by McAllister Software Systems; both names appear in footers.
  { label: "AVImark product name", pattern: /\bavimark(?:®|\(r\))?\b/i },
  { label: "McAllister Software footer", pattern: /mcallister\s+software/i },
  { label: "Covetrus AVImark vendor mark", pattern: /covetrus[^\n]{0,40}avimark/i },
  // Distinctive Medical History column ordering.
  {
    label: "Medical History column header (Date Code Description Qty Amount)",
    pattern: /\bdate\b[^\n]{0,40}\bcode\b[^\n]{0,40}\bdescription\b[^\n]{0,40}\bqty\b[^\n]{0,40}\bamount\b/i,
  },
  { label: '"Medical History" section heading', pattern: /\bmedical\s+history\b/i },
  // AVImark service codes are category-prefixed: VAC-RAB, EXM-COMP, SX-NEUT…
  {
    label: "AVImark category-prefixed service codes",
    pattern: /\b(?:VAC|EXM|SX|LAB|RAD|DEN|HW|FL|PHARM|RX|ANES|HOSP|BOARD)-[A-Z0-9]{2,8}\b/,
  },
  // AVImark account/treatment code style with leading category letter.
  {
    label: "AVImark treatment code pattern",
    pattern: /\b[A-Z]{2,4}-[A-Z0-9]+\b.{0,40}\b(?:vaccine|exam|surgery|lab|radiograph|dental)/i,
  },
];

const EVETPRACTICE_SIGNALS: SignalRule[] = [
  // Vendor markings.
  { label: "eVetPractice product name", pattern: /\bevetpractice\b/i },
  { label: "Covetrus eVetPractice vendor mark", pattern: /covetrus[^\n]{0,40}evet/i },
  // Browser-print chrome — eVetPractice is web-only, so its PDFs almost always
  // carry browser footer artifacts.
  { label: "Browser print URL footer", pattern: /https?:\/\/[^\s]*evetpractice/i },
  { label: 'Browser "Page X of Y" footer', pattern: /\bpage\s+\d+\s+of\s+\d+\b/i },
  { label: "Generic eVetPractice URL footer", pattern: /https?:\/\/[a-z0-9.-]+\/(?:medical|patient|record)/i },
  // Explicit SOAP framing — eVetPractice prints S/O/A/P as labeled sections.
  {
    label: "Explicit S/O/A/P section headers",
    pattern: /(^|\n)\s*S\s*:[^\n]{3,}\n[\s\S]{0,400}(^|\n)\s*O\s*:[^\n]{3,}\n[\s\S]{0,400}(^|\n)\s*A\s*:/m,
  },
  // CSS-table fingerprints sometimes survive PDF rendering as inline tokens.
  { label: "CSS table-style artifact", pattern: /\b(?:cellpadding|cellspacing|border-collapse)\b/i },
];

const EZYVET_SIGNALS: SignalRule[] = [
  // Vendor markings.
  { label: "ezyVet product name", pattern: /\bezy\s*vet\b/i },
  { label: "IDEXX ezyVet vendor mark", pattern: /idexx[^\n]{0,40}ezy\s*vet/i },
  // Layout fingerprints — ezyVet renders A4 cloud reports with cards grouped
  // by date and provider initials in the card header.
  {
    label: "Date-grouped clinical card header",
    pattern: /\b(?:0?[1-9]|[12][0-9]|3[01])[\/\-\s](?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|0?[1-9]|1[0-2])[\/\-\s]\d{2,4}\b.{0,40}\b[A-Z]{2,3}\b/i,
  },
  {
    label: "Provider initials marker (ezyVet card)",
    pattern: /\b(?:created|entered|seen)\s+by\s*:?\s*[A-Z]{2,3}\b/i,
  },
  { label: "ezyVet consultation block", pattern: /\bconsult(?:ation)?\s+(?:notes?|record)\b/i },
  // A4 cloud layout hint — ezyVet exports include a clinic header table with
  // both clinic and patient blocks at the top.
  {
    label: "ezyVet clinic + patient header block",
    pattern: /\bclinic\b[\s\S]{0,200}\bpatient\b[\s\S]{0,200}\b(?:owner|client)\b/i,
  },
];

const SOAP_EXPORT_SIGNALS: SignalRule[] = [
  // Standalone S/O/A/P labels without surrounding PIMS chrome.
  {
    label: "Standalone S: header",
    pattern: /(^|\n)\s*S\s*:\s*[A-Z]/m,
  },
  {
    label: "Standalone O: header",
    pattern: /(^|\n)\s*O\s*:\s*[A-Z]/m,
  },
  {
    label: "Standalone A: header",
    pattern: /(^|\n)\s*A\s*:\s*[A-Z]/m,
  },
  {
    label: "Standalone P: header",
    pattern: /(^|\n)\s*P\s*:\s*[A-Z]/m,
  },
  {
    label: 'Spelled-out SOAP block ("Subjective" / "Objective")',
    pattern: /\bsubjective\b[\s\S]{0,400}\bobjective\b[\s\S]{0,400}\bassessment\b[\s\S]{0,400}\bplan\b/i,
  },
];

// ---------------------------------------------------------------------------
// Scoring.
// ---------------------------------------------------------------------------

function countMatches(text: string, rules: SignalRule[]): string[] {
  const matched: string[] = [];
  for (const rule of rules) {
    if (rule.pattern.test(text)) {
      matched.push(rule.label);
    }
  }
  return matched;
}

function confidenceForSignalCount(n: number): number {
  if (n <= 0) return 0;
  if (n === 1) return 0.4;
  if (n === 2) return 0.7;
  if (n === 3) return 0.85;
  return 0.95;
}

// Family priority for tie-breaking: more specific PIMS before the generic
// SOAP fallback. Cornerstone and AVImark are the most distinctive (strong
// vendor strings), then eVetPractice (browser chrome), then ezyVet (layout-
// dependent), then soap_export as a recognizable-but-unbranded fallback.
const FAMILY_PRIORITY: Exclude<PimsFamily, "unknown">[] = [
  "cornerstone",
  "avimark",
  "evetpractice",
  "ezyvet",
  "soap_export",
];

export function classifyPimsFromText(textSample: string): PimsSignals {
  const text = (textSample ?? "").slice(0, 6000);

  if (!text.trim()) {
    return { family: "unknown", confidence: 0, matched_signals: [] };
  }

  const scores: Record<Exclude<PimsFamily, "unknown">, string[]> = {
    cornerstone: countMatches(text, CORNERSTONE_SIGNALS),
    avimark: countMatches(text, AVIMARK_SIGNALS),
    evetpractice: countMatches(text, EVETPRACTICE_SIGNALS),
    ezyvet: countMatches(text, EZYVET_SIGNALS),
    soap_export: countMatches(text, SOAP_EXPORT_SIGNALS),
  };

  // Pick highest count, breaking ties by FAMILY_PRIORITY order.
  let best: Exclude<PimsFamily, "unknown"> | null = null;
  let bestCount = 0;
  for (const family of FAMILY_PRIORITY) {
    const n = scores[family].length;
    if (n > bestCount) {
      best = family;
      bestCount = n;
    }
  }

  if (!best || bestCount === 0) {
    return { family: "unknown", confidence: 0, matched_signals: [] };
  }

  return {
    family: best,
    confidence: confidenceForSignalCount(bestCount),
    matched_signals: scores[best],
  };
}

// ---------------------------------------------------------------------------
// Prompt fragments — injected into the extraction prompt when a family is
// detected with sufficient confidence. Caller decides the confidence floor.
// ---------------------------------------------------------------------------

const PROMPT_FRAGMENTS: Record<PimsFamily, string> = {
  cornerstone: [
    "PIMS DETECTED: IDEXX Cornerstone.",
    "- The patient signalment banner (name, species, breed, DOB, owner) repeats at the top of every page. Deduplicate aggressively — do not emit a separate event for each page header.",
    '- "Medical Notes" sections contain narrative SOAP-style entries. Treat each dated note as one event.',
    "- Footer/header text (page numbers, clinic name, “Cornerstone” branding) is chrome — ignore.",
    "- Dates are typically MM/DD/YYYY in US clinics. Use the date attached to the note, not the report-print date.",
  ].join("\n"),

  avimark: [
    "PIMS DETECTED: Covetrus AVImark.",
    "- The Medical History table has columns in this exact order: Date | Code | Description | Qty | Amount. Parse rows accordingly.",
    "- Service codes are category-prefixed (e.g. VAC-RAB = rabies vaccine, EXM-COMP = comprehensive exam, SX-NEUT = neuter surgery, LAB-CBC, RAD-CHEST, DEN-PROPHY). Use the prefix to infer event type when description is terse.",
    "- The Amount column is billing data, not clinical — surface it only if the caller asks for charges. Skip pure billing rows (taxes, discounts, dispensing fees).",
    '- Footer "AVImark" / "McAllister Software" is chrome — ignore.',
  ].join("\n"),

  evetpractice: [
    "PIMS DETECTED: Covetrus eVetPractice.",
    "- This is a browser-printed PDF. The footer “Page X of Y” and any URL footer (https://...) are browser chrome — ignore.",
    "- S/O/A/P headers are explicit and labeled (S:, O:, A:, P: or Subjective/Objective/Assessment/Plan). Treat each labeled block as part of one clinical event, not four separate events.",
    "- CSS/table artifacts (cellpadding, border-collapse) sometimes survive the print pipeline — strip them.",
    "- Date headers typically appear above each visit card.",
  ].join("\n"),

  ezyvet: [
    "PIMS DETECTED: IDEXX ezyVet.",
    "- Records are organized as date-grouped cards. Each card represents one clinical event.",
    "- Provider initials (2–3 capital letters) appear at the top of each card — capture as provider_name when available.",
    "- A4 cloud layout: clinic header at top, then patient block, then dated consultation entries. The clinic + patient blocks repeat on every page — deduplicate.",
    "- Consultation notes use a free-text format; SOAP structure may be implicit rather than labeled.",
  ].join("\n"),

  soap_export: [
    "PIMS DETECTED: generic SOAP export (origin PIMS unknown).",
    "- The document uses explicit S/O/A/P (or Subjective/Objective/Assessment/Plan) blocks without PIMS-specific framing.",
    "- Extract one clinical event per SOAP block. Use the date attached to the block; if absent, fall back to the document-level date.",
    "- No vendor chrome to strip — but watch for repeated header/footer if the export was paginated.",
  ].join("\n"),

  unknown: "",
};

export function pimsPromptFragment(family: PimsFamily): string {
  return PROMPT_FRAGMENTS[family] ?? "";
}
