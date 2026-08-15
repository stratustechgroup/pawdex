import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

/**
 * Records what each LLM call consumed and cost.
 *
 * Fire-and-forget by construction: every function here swallows its own errors.
 * Telemetry must never be able to fail a user's document commit, so the worst a
 * broken insert can do is lose a usage row.
 *
 * Cost comes from OpenRouter's usage accounting (enabled once at the provider
 * in lib/ai/openrouter.ts), not from a local price table — a hardcoded table
 * goes stale the moment a model is repriced or the tier env vars are pointed at
 * a different model.
 */

export type AiFeature = "extract" | "qa" | "policy" | "pec-refine" | "embed";

/** The subset of the AI SDK's usage object we persist. All fields optional. */
type SdkUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
} | null | undefined;

/**
 * OpenRouter reports the exact charge in USD under
 * providerMetadata.openrouter.usage.cost. Dig it out defensively: the shape is
 * provider-specific and absent whenever usage accounting is off or the call
 * failed before billing.
 */
export function costMicroUsdFrom(providerMetadata: unknown): number | null {
  try {
    const openrouter = (providerMetadata as Record<string, unknown> | undefined)?.openrouter as
      | Record<string, unknown>
      | undefined;
    const usage = openrouter?.usage as Record<string, unknown> | undefined;
    const cost = usage?.cost;
    if (typeof cost !== "number" || !Number.isFinite(cost)) return null;
    // USD -> micro-USD. Round rather than truncate so sub-micro charges don't
    // all collapse to zero.
    return Math.round(cost * 1_000_000);
  } catch {
    return null;
  }
}

function intOrNull(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n) : null;
}

export type RecordAiUsageArgs = {
  feature: AiFeature;
  model: string;
  tier?: number | null;
  usage?: SdkUsage;
  providerMetadata?: unknown;
  latencyMs?: number;
  ok?: boolean;
  householdId?: string | null;
  documentId?: string | null;
  extractionId?: string | null;
};

/**
 * Persist one usage row. Never throws, never rejects.
 *
 * Deliberately not awaited by most callers — but it IS safe to await, and
 * awaiting inside an `after()` block is preferable to floating the promise in a
 * serverless runtime where the instance may be frozen before an unawaited
 * promise settles.
 */
export async function recordAiUsage(args: RecordAiUsageArgs): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("ai_usage").insert({
      feature: args.feature,
      model: args.model,
      tier: args.tier ?? null,
      input_tokens: intOrNull(args.usage?.inputTokens),
      output_tokens: intOrNull(args.usage?.outputTokens),
      total_tokens: intOrNull(args.usage?.totalTokens),
      cached_input_tokens: intOrNull(args.usage?.cachedInputTokens),
      reasoning_tokens: intOrNull(args.usage?.reasoningTokens),
      cost_microusd: costMicroUsdFrom(args.providerMetadata),
      latency_ms: intOrNull(args.latencyMs),
      ok: args.ok ?? true,
      household_id: args.householdId ?? null,
      document_id: args.documentId ?? null,
      extraction_id: args.extractionId ?? null,
    });
    if (error) {
      console.error("[ai-usage] insert failed", error.message);
    }
  } catch (err) {
    console.error("[ai-usage] threw", err);
  }
}
