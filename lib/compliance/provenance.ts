/**
 * Rule provenance — every requirement the engines render traces to the
 * primary source it was verified against, with a re-verification deadline.
 *
 * Rules engines rot, and this one rots into quarantines: a stale rule here
 * strands someone's dog at a border. The manifest makes staleness visible in
 * three ways:
 *  1. The UI stamps each requirement "Last verified <date> · <source domain>"
 *     — a trust feature no competitor surfaced in the Aug 2026 research had.
 *  2. verify_by dates give operations a concrete re-check calendar.
 *  3. rulesNeedingVerification() lets a future cron or CI step flag overdue
 *     rules automatically.
 *
 * HARD CALENDAR ITEMS (verify_by encodes these):
 *  - 2026-09-30 / 10-01: EU non-commercial certificate changeover. "The new
 *    non-commercial health certificates will go into effect on October 1,
 *    2026. The current certificates can be endorsed on or before September
 *    30, 2026." (APHIS). Formats were unpublished at verification time.
 *  - 2026-10-16 / 10-17: the commercial certificate follows.
 *  - CDC's high-risk country list is the most change-prone page in the US
 *    re-entry set — shortest cadence below.
 *
 * Quotes live in docs/pet-passport-deep-dive.md §3/§10; keep this file to
 * source + dates so it stays cheap to re-verify.
 */

export type RuleProvenance = {
  /** Requirement id as rendered (matches Requirement.id). */
  rule_id: string;
  /** Which regime(s) the entry covers. */
  jurisdiction: "eu" | "gb" | "us-reentry";
  source_url: string;
  /** ISO date the rule was last verified against the source. */
  retrieved_at: string;
  /** ISO date by which it must be re-verified. */
  verify_by: string;
};

const EU_RETRIEVED = "2026-08-16";
const GOV_CADENCE_VERIFY_BY = "2026-11-14"; // ~90 days for stable gov sources

export const RULE_SOURCES: RuleProvenance[] = [
  // ── EU regime ─────────────────────────────────────────────────────────
  { rule_id: "microchip", jurisdiction: "eu", source_url: "https://food.ec.europa.eu/animals/movement-pets/eu-legislation/non-commercial-movement-non-eu-countries_en", retrieved_at: EU_RETRIEVED, verify_by: GOV_CADENCE_VERIFY_BY },
  { rule_id: "age", jurisdiction: "eu", source_url: "https://eur-lex.europa.eu/eli/reg_del/2026/131/oj/eng", retrieved_at: EU_RETRIEVED, verify_by: GOV_CADENCE_VERIFY_BY },
  { rule_id: "rabies", jurisdiction: "eu", source_url: "https://eur-lex.europa.eu/eli/reg_del/2026/131/oj/eng", retrieved_at: EU_RETRIEVED, verify_by: GOV_CADENCE_VERIFY_BY },
  { rule_id: "rabies-wait", jurisdiction: "eu", source_url: "https://eur-lex.europa.eu/eli/reg_del/2026/131/oj/eng", retrieved_at: EU_RETRIEVED, verify_by: GOV_CADENCE_VERIFY_BY },
  { rule_id: "chip-before-rabies", jurisdiction: "eu", source_url: "https://food.ec.europa.eu/animals/movement-pets/eu-legislation/non-commercial-movement-non-eu-countries_en", retrieved_at: EU_RETRIEVED, verify_by: GOV_CADENCE_VERIFY_BY },
  { rule_id: "titer", jurisdiction: "eu", source_url: "https://eur-lex.europa.eu/eli/reg_impl/2026/636/oj/eng", retrieved_at: EU_RETRIEVED, verify_by: GOV_CADENCE_VERIFY_BY },
  { rule_id: "tapeworm", jurisdiction: "eu", source_url: "https://europa.eu/youreurope/citizens/travel/carry/pets-and-other-animals/index_en.htm", retrieved_at: EU_RETRIEVED, verify_by: GOV_CADENCE_VERIFY_BY },
  // The EU certificate changeover is a hard date, not a cadence.
  { rule_id: "ehc", jurisdiction: "eu", source_url: "https://www.aphis.usda.gov/pet-travel/vehcs", retrieved_at: EU_RETRIEVED, verify_by: "2026-09-30" },

  // ── GB regime ─────────────────────────────────────────────────────────
  { rule_id: "microchip", jurisdiction: "gb", source_url: "https://www.gov.uk/bring-pet-to-great-britain", retrieved_at: EU_RETRIEVED, verify_by: GOV_CADENCE_VERIFY_BY },
  { rule_id: "rabies", jurisdiction: "gb", source_url: "https://www.gov.uk/bring-pet-to-great-britain/rabies-vaccination-boosters", retrieved_at: EU_RETRIEVED, verify_by: GOV_CADENCE_VERIFY_BY },
  { rule_id: "rabies-age", jurisdiction: "gb", source_url: "https://www.gov.uk/bring-pet-to-great-britain/rabies-vaccination-boosters", retrieved_at: EU_RETRIEVED, verify_by: GOV_CADENCE_VERIFY_BY },
  { rule_id: "rabies-wait", jurisdiction: "gb", source_url: "https://www.gov.uk/bring-pet-to-great-britain/rabies-vaccination-boosters", retrieved_at: EU_RETRIEVED, verify_by: GOV_CADENCE_VERIFY_BY },
  { rule_id: "chip-before-rabies", jurisdiction: "gb", source_url: "https://www.gov.uk/bring-pet-to-great-britain", retrieved_at: EU_RETRIEVED, verify_by: GOV_CADENCE_VERIFY_BY },
  { rule_id: "titer", jurisdiction: "gb", source_url: "https://www.gov.uk/bring-pet-to-great-britain/which-pet-travel-document", retrieved_at: EU_RETRIEVED, verify_by: GOV_CADENCE_VERIFY_BY },
  { rule_id: "tapeworm", jurisdiction: "gb", source_url: "https://www.gov.uk/bring-pet-to-great-britain/tapeworm-treatment-dogs", retrieved_at: EU_RETRIEVED, verify_by: GOV_CADENCE_VERIFY_BY },
  { rule_id: "gb-phc", jurisdiction: "gb", source_url: "https://www.gov.uk/bring-pet-to-great-britain/great-britain-pet-health-certificate", retrieved_at: EU_RETRIEVED, verify_by: GOV_CADENCE_VERIFY_BY },
  { rule_id: "gb-route", jurisdiction: "gb", source_url: "https://www.gov.uk/bring-pet-to-great-britain/travel-routes-pets", retrieved_at: EU_RETRIEVED, verify_by: GOV_CADENCE_VERIFY_BY },

  // ── US re-entry ───────────────────────────────────────────────────────
  { rule_id: "us-reentry-form", jurisdiction: "us-reentry", source_url: "https://www.ecfr.gov/current/title-42/chapter-I/subchapter-F/part-71/subpart-D/section-71.51", retrieved_at: EU_RETRIEVED, verify_by: "2026-10-15" }, // CDC list churns; shortest cadence
  { rule_id: "us-reentry-age", jurisdiction: "us-reentry", source_url: "https://www.ecfr.gov/current/title-42/chapter-I/subchapter-F/part-71/subpart-D/section-71.51", retrieved_at: EU_RETRIEVED, verify_by: GOV_CADENCE_VERIFY_BY },
  { rule_id: "us-reentry", jurisdiction: "us-reentry", source_url: "https://www.cdc.gov/importation/bringing-an-animal-into-the-us/index.html", retrieved_at: EU_RETRIEVED, verify_by: GOV_CADENCE_VERIFY_BY },
];

export function provenanceFor(
  ruleId: string,
  regime: "eu" | "gb",
): RuleProvenance | undefined {
  const jurisdiction = ruleId.startsWith("us-reentry") ? "us-reentry" : regime;
  return RULE_SOURCES.find(
    (r) => r.rule_id === ruleId && r.jurisdiction === jurisdiction,
  );
}

/** Rules whose verify_by has passed — for an ops check or future cron. */
export function rulesNeedingVerification(todayIso: string): RuleProvenance[] {
  return RULE_SOURCES.filter((r) => r.verify_by <= todayIso);
}

export function sourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
