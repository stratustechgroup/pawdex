import { z } from "zod";

// Subset of the insurance_policies schema that an LLM can plausibly fill from
// a typical policy PDF. We deliberately keep this narrow + flat — chasing
// every cited clause in a 30-page policy isn't what this layer is for.

// v6.1 — Financial fields now carry a citation alongside the value so the
// review UI can render click-to-highlight against the source PDF and so a
// second-pass verifier (cheap model re-reads the cited span) can confirm the
// value before it's persisted. We keep the canonical scalar (e.g.
// `deductible_annual_dollars`) AND add a parallel `raw_text` + `source_page`.

const financialCitationShape = {
  source_page: z
    .number()
    .int()
    .nullable()
    .describe(
      "1-indexed page where this value appears. Null when single-page or unknown.",
    ),
  raw_text: z
    .string()
    .nullable()
    .describe(
      "Verbatim quote from the policy supporting this value — required when value is non-null. ~80 chars.",
    ),
};

export const policyExtractionSchema = z.object({
  insurer_name: z
    .string()
    .min(1)
    .describe(
      "Name of the insurer as it appears on the policy (e.g. 'Trupanion', 'Lemonade Pet').",
    ),
  plan_name: z
    .string()
    .nullable()
    .describe(
      "Plan / product name if shown (e.g. 'Complete Coverage', 'Preferred Plus'). Null if not present.",
    ),
  policy_number: z.string().nullable(),

  // --- Premium ---
  premium_monthly_dollars: z
    .number()
    .nullable()
    .describe(
      "Monthly premium in USD. Convert from annual if only annual is shown. Null when truly absent.",
    ),
  premium_source_page: financialCitationShape.source_page,
  premium_raw_text: financialCitationShape.raw_text,

  // --- Deductible ---
  deductible_annual_dollars: z
    .number()
    .nullable()
    .describe(
      "Deductible amount in USD. The DOLLAR figure — use deductible_type to capture annual vs per-incident vs per-condition-lifetime. Use 0 only when the policy explicitly states 'no deductible'.",
    ),
  // v6.1 — Trupanion uses per-condition-lifetime; most others use annual; a
  // few legacy plans use per-incident. Without this, we silently lose the
  // single most important detail in the deductible.
  deductible_type: z
    .enum(["annual", "per_incident", "per_condition_lifetime"])
    .nullable()
    .describe(
      "How the deductible is applied. 'annual' = reset every policy year (most plans). 'per_incident' = reset per claim (some legacy plans). 'per_condition_lifetime' = once per condition forever (Trupanion). Null if unclear.",
    ),
  deductible_source_page: financialCitationShape.source_page,
  deductible_raw_text: financialCitationShape.raw_text,

  // --- Annual max ---
  annual_max_dollars: z
    .number()
    .nullable()
    .describe(
      "Annual benefit maximum in USD. Null = unlimited (Trupanion, Healthy Paws) OR not specified — disambiguate via raw_text.",
    ),
  annual_max_source_page: financialCitationShape.source_page,
  annual_max_raw_text: financialCitationShape.raw_text,

  // --- Reimbursement rate + basis ---
  reimbursement_rate: z
    .number()
    .nullable()
    .describe(
      "Reimbursement rate as a decimal between 0 and 1 (0.80 = 80%). Null when not stated. Must be in [0, 1] — post-extraction clamping is applied.",
    ),
  // v6.1 — "% of invoice" vs "% of allowable / VFS schedule" can be the
  // difference between $800 and $300 reimbursed on the same vet bill.
  reimbursement_basis: z
    .enum(["invoice", "schedule", "usual_and_customary"])
    .nullable()
    .describe(
      "What the percentage applies to. 'invoice' = % of actual vet bill (Trupanion, Healthy Paws — most modern plans). 'schedule' = % of a fixed-fee schedule (ASPCA LPI legacy plans, some Pumpkin). 'usual_and_customary' = % of insurer's UCR figure (rare). Null if unclear.",
    ),
  reimbursement_source_page: financialCitationShape.source_page,
  reimbursement_raw_text: financialCitationShape.raw_text,

  // --- Dates ---
  effective_on: z
    .string()
    .nullable()
    .describe("Policy effective date in ISO YYYY-MM-DD. Null if not on the document."),
  renews_on: z
    .string()
    .nullable()
    .describe("Next renewal date in ISO YYYY-MM-DD. Null if not stated."),

  // --- Exclusions + PEC ---
  extracted_exclusions: z
    .array(z.string())
    .describe(
      "Each line is a single exclusion as written in the policy. Capture exclusions VERBATIM where practical — paraphrasing introduces ambiguity that matters for claim disputes. Include hereditary conditions, breed-specific exclusions, behavioral, dental cleanings, etc.",
    ),
  pre_existing_condition_window_months: z
    .number()
    .nullable()
    .describe(
      "If the policy defines a 'lookback' or 'clean' window for pre-existing conditions (e.g. 'symptoms during the 12 months before policy effective date are PEC'), capture the number of months. Null when not specified.",
    ),
  pre_existing_condition_definitions: z
    .array(z.string())
    .describe(
      "Each line is one PEC-defining statement from the policy. Capture verbatim. Empty array if PEC isn't formally defined.",
    ),
  // v6.1 — When the upstream PEC pre-filter (lib/insurance/pec-prefilter.ts)
  // tags spans, classify each into one of these categories. This lets
  // downstream PEC matching distinguish Embrace/Fetch/Lemonade's
  // curable-condition reinstatement language from a permanent exclusion.
  pec_clauses: z
    .array(
      z.object({
        category: z
          .enum([
            "permanent",
            "curable-with-waiting",
            "bilateral-extension",
            "symptom-only",
            "lookback-window",
            "definition",
            "ambiguous",
          ])
          .describe(
            "permanent = excluded forever. curable-with-waiting = un-excluded after N symptom-free months/days. bilateral-extension = one knee/eye extends to other. symptom-only = exclusion triggers on noted symptoms not formal diagnosis. lookback-window = pre-policy clean-window definition. definition = defines 'pre-existing' without invoking. ambiguous = unclear.",
          ),
        raw_text: z
          .string()
          .describe(
            "Verbatim quote from the policy — the sentence or clause this classification covers.",
          ),
        source_page: z.number().int().nullable(),
        symptom_free_window_days: z
          .number()
          .int()
          .nullable()
          .describe(
            "When category is 'curable-with-waiting': how many symptom-free days/months until coverage reinstates. Null otherwise.",
          ),
      }),
    )
    .describe(
      "Per-clause PEC classification. Drives whether downstream PEC matching treats a condition as permanently excluded vs un-excluded after a clean window.",
    ),

  // --- Waiting periods ---
  // v6.1 — Carriers split waiting periods by category (accident is often
  // shorter than illness, orthopedic conditions have their own window).
  waiting_period_accident_days: z.number().int().nullable(),
  waiting_period_illness_days: z.number().int().nullable(),
  waiting_period_orthopedic_days: z.number().int().nullable(),
  waiting_period_cruciate_days: z.number().int().nullable(),

  notes: z
    .string()
    .nullable()
    .describe(
      "Anything notable that doesn't fit a field above — riders, claim filing window, exam-fee coverage, etc.",
    ),
  confidence_overall: z
    .number()
    .describe(
      "Your read on how cleanly you understood this policy as a whole. Between 0 and 1 — must be in [0, 1].",
    ),
});

export type PolicyExtractionResult = z.infer<typeof policyExtractionSchema>;
