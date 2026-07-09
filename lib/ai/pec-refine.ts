import "server-only";

import { generateObject } from "ai";
import { z } from "zod";

import { getOpenRouter, MODEL_TIER2 } from "@/lib/ai/openrouter";
import type { PolicyPECAnalysis } from "@/lib/db/pec-analysis";

const SYSTEM_PROMPT = `You are reviewing a heuristic pre-existing-condition flagger's matches between a pet's medical events and an insurance policy's exclusion list. The heuristic over-flags because it matches on token overlap; your job is to filter false positives and rate each true match.

For each (event, exclusion) pair, decide:
- "match" — the event clearly falls under the exclusion (e.g. event "Hip dysplasia x-ray, bilateral" + exclusion "hereditary conditions including hip dysplasia").
- "ambiguous" — could go either way; surface with a hedge.
- "false_positive" — the words overlap but the clinical meaning doesn't (e.g. event "Ear cropping post-op recheck" + exclusion "ear infections" — same word, different condition).

Rules:
- Be CONSERVATIVE with "match" — when in doubt, downgrade to "ambiguous".
- Never invent medical interpretations beyond what the event text says.
- The user will see your verdict in a UI labeled "informational" — the goal is to reduce noise, not to make claim decisions.`;

const refineResponseSchema = z.object({
  verdicts: z.array(
    z.object({
      event_id: z.string(),
      exclusion: z.string(),
      verdict: z.enum(["match", "ambiguous", "false_positive"]),
      rationale: z.string().describe("One-sentence explanation, plain English."),
    }),
  ),
});

export type RefinedVerdict = {
  event_id: string;
  exclusion: string;
  verdict: "match" | "ambiguous" | "false_positive";
  rationale: string;
};

export async function refinePECAnalysis(
  policy: PolicyPECAnalysis,
): Promise<RefinedVerdict[]> {
  if (policy.flagged.length === 0) return [];

  // Build the input — one row per (event, top-match exclusion).
  const pairs = policy.flagged.map((f) => ({
    event_id: f.event_id,
    title: f.title,
    diagnosis: f.diagnosis,
    occurred_on: f.occurred_on,
    exclusion: f.matches[0].exclusion,
  }));

  const openrouter = getOpenRouter();
  const { object } = await generateObject({
    model: openrouter(MODEL_TIER2),
    schema: refineResponseSchema,
    system: SYSTEM_PROMPT,
    prompt: `Insurer: ${policy.insurer_name}\n\nReview each row:\n\n${pairs
      .map(
        (p, i) =>
          `[${i + 1}] Event: "${p.title}"${p.diagnosis ? ` (diagnosis: ${p.diagnosis})` : ""} on ${p.occurred_on}\n    Exclusion: "${p.exclusion}"\n    event_id: ${p.event_id}`,
      )
      .join("\n\n")}\n\nReturn one verdict per row.`,
  });

  return object.verdicts;
}
