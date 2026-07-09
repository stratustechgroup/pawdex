import "server-only";

import { createClient } from "@/lib/supabase/server";

// Tokens that should never anchor a PEC match — they're either too common
// or non-medical "filler" that produces false positives ("treatment for ear
// infection" shouldn't match an exclusion that contains "ear" alone).
const STOPWORDS = new Set([
  "and",
  "or",
  "the",
  "of",
  "for",
  "in",
  "on",
  "to",
  "a",
  "an",
  "is",
  "are",
  "with",
  "without",
  "any",
  "all",
  "other",
  "due",
  "from",
  "by",
  "as",
  "at",
  "be",
  "been",
  "such",
  "that",
  "this",
  "these",
  "those",
  "including",
  "treatment",
  "treatments",
  "condition",
  "conditions",
  "disease",
  "diseases",
  "disorder",
  "disorders",
  "symptom",
  "symptoms",
  "history",
  "related",
  "associated",
  "secondary",
  "primary",
  "evaluation",
  "examination",
  "visit",
  "office",
  "ear", // too generic alone — left vs right ear, ear infection vs ear cropping
  "eye",
  "left",
  "right",
  "bilateral",
  "unilateral",
  "acute",
  "chronic",
  "mild",
  "moderate",
  "severe",
  "vet",
  "veterinary",
  "pet",
  "dog",
  "cat",
]);

function tokens(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

export type PECMatch = {
  exclusion: string;
  exclusion_tokens: string[];
  overlap: string[];
  overlap_count: number;
};

export type PECFlaggedEvent = {
  event_id: string;
  event_type: string;
  occurred_on: string;
  title: string;
  diagnosis: string | null;
  matches: PECMatch[];
};

export type PolicyPECAnalysis = {
  policy_id: string;
  insurer_name: string;
  exclusions_count: number;
  flagged: PECFlaggedEvent[];
};

/**
 * Heuristic PEC analysis — matches each medical event's title + diagnosis
 * against each policy exclusion via token-overlap. A match requires at least
 * MIN_OVERLAP non-stopword tokens to share between the exclusion and the
 * event. This catches "hip dysplasia" excluded against an event titled
 * "Hip dysplasia diagnosis (bilateral)" while skipping false positives like
 * "ear infection" matching against "ear cropping" exclusion.
 *
 * Intentionally heuristic, not AI — the UI always frames results as
 * "informational, verify with your insurer" and the heuristic is cheap +
 * deterministic + auditable.
 */
const MIN_OVERLAP = 2;

export async function analyzePECForHousehold(
  householdId: string,
): Promise<PolicyPECAnalysis[]> {
  const supabase = await createClient();

  const [policiesRes, eventsRes] = await Promise.all([
    supabase
      .from("insurance_policies")
      .select("id, insurer_name, extracted_exclusions, pet_id")
      .eq("household_id", householdId)
      .is("archived_at", null)
      .not("extracted_exclusions", "is", null),
    supabase
      .from("medical_events")
      .select("id, event_type, occurred_on, title, diagnosis, pet_id")
      .eq("household_id", householdId)
      .order("occurred_on", { ascending: false }),
  ]);

  type PolicyRow = {
    id: string;
    insurer_name: string;
    extracted_exclusions: string[] | null;
    pet_id: string | null;
  };
  type EventRow = {
    id: string;
    event_type: string;
    occurred_on: string;
    title: string;
    diagnosis: string | null;
    pet_id: string;
  };

  const policies = (policiesRes.data ?? []) as PolicyRow[];
  const events = (eventsRes.data ?? []) as EventRow[];

  const results: PolicyPECAnalysis[] = [];

  for (const policy of policies) {
    const exclusions = policy.extracted_exclusions ?? [];
    if (exclusions.length === 0) continue;

    // If the policy is scoped to a specific pet, restrict events to that pet.
    const scopedEvents = policy.pet_id
      ? events.filter((e) => e.pet_id === policy.pet_id)
      : events;

    const exclusionTokenSets = exclusions.map((ex) => ({
      exclusion: ex,
      tokens: new Set(tokens(ex)),
    }));

    const flagged: PECFlaggedEvent[] = [];
    for (const event of scopedEvents) {
      const eventTokens = new Set([
        ...tokens(event.title),
        ...tokens(event.diagnosis),
      ]);
      if (eventTokens.size === 0) continue;

      const matches: PECMatch[] = [];
      for (const ex of exclusionTokenSets) {
        if (ex.tokens.size === 0) continue;
        const overlap: string[] = [];
        for (const t of ex.tokens) {
          if (eventTokens.has(t)) overlap.push(t);
        }
        if (overlap.length >= MIN_OVERLAP) {
          matches.push({
            exclusion: ex.exclusion,
            exclusion_tokens: Array.from(ex.tokens),
            overlap,
            overlap_count: overlap.length,
          });
        }
      }
      if (matches.length > 0) {
        // Surface the most-specific match first (highest overlap count).
        matches.sort((a, b) => b.overlap_count - a.overlap_count);
        flagged.push({
          event_id: event.id,
          event_type: event.event_type,
          occurred_on: event.occurred_on,
          title: event.title,
          diagnosis: event.diagnosis,
          matches,
        });
      }
    }

    results.push({
      policy_id: policy.id,
      insurer_name: policy.insurer_name,
      exclusions_count: exclusions.length,
      flagged,
    });
  }

  return results;
}
