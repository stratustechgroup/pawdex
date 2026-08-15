import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

/**
 * Abuse ceiling on AI extraction spend.
 *
 * This is NOT the plan entitlement. `canRunAiExtraction` in lib/billing governs
 * *product* limits (Free gets 10 extractions a month) and is currently advisory
 * because `canEnforce()` returns false. That leaves nothing at all standing
 * between a runaway client, a retry loop, or a hostile uploader and an unbounded
 * OpenRouter bill — tier 3 is Claude Sonnet, so this is real money.
 *
 * So this guard is deliberately independent of plan and of billing being on:
 *   - Limits sit far above any legitimate use. A real household files a handful
 *     of vet documents a month, not fifty a day. Nobody legitimate will ever
 *     see this.
 *   - It is a backstop, not a product rule. When billing enforcement lands,
 *     THAT becomes the user-facing limit and this stays underneath it unchanged.
 *
 * Two ceilings, because they fail differently: the per-household cap contains
 * one bad actor or one broken client, and the global cap contains a systemic
 * problem (a retry storm across many households, or a bug in our own code) that
 * a per-household cap would never catch.
 *
 * Counting is by rows in document_extractions, which is what an extraction
 * actually costs us — one row per LLM run, including retries and escalations.
 */

const DEFAULT_PER_HOUSEHOLD_PER_DAY = 50;
const DEFAULT_GLOBAL_PER_DAY = 500;

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function extractionLimits(): { perHousehold: number; global: number } {
  return {
    perHousehold: intFromEnv("PAWDEX_MAX_EXTRACTIONS_PER_HOUSEHOLD_PER_DAY", DEFAULT_PER_HOUSEHOLD_PER_DAY),
    global: intFromEnv("PAWDEX_MAX_EXTRACTIONS_PER_DAY", DEFAULT_GLOBAL_PER_DAY),
  };
}

export type BudgetVerdict = {
  allowed: boolean;
  /** Which ceiling was hit. Undefined when allowed. */
  scope?: "household" | "global";
  used: number;
  limit: number;
  /** Safe to show a user. Never leaks the global figure to an end user. */
  message?: string;
};

/**
 * Whether another extraction may run for this household right now.
 *
 * Fails OPEN. If the counting query itself errors, we allow the extraction and
 * log loudly: a transient database blip should not stop someone filing their
 * dog's rabies certificate. The downside of failing open here is bounded (the
 * next call re-checks) whereas failing closed would turn a database hiccup into
 * a total ingestion outage.
 */
export async function checkExtractionBudget(args: {
  householdId: string;
}): Promise<BudgetVerdict> {
  const { perHousehold, global } = extractionLimits();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const supabase = createServiceClient();

  try {
    const [householdRes, globalRes] = await Promise.all([
      supabase
        .from("document_extractions")
        .select("id", { head: true, count: "exact" })
        .eq("household_id", args.householdId)
        .gte("extracted_at", since),
      supabase
        .from("document_extractions")
        .select("id", { head: true, count: "exact" })
        .gte("extracted_at", since),
    ]);

    if (householdRes.error || globalRes.error) {
      console.error("[spend-guard] count failed, allowing through", {
        household: householdRes.error?.message,
        global: globalRes.error?.message,
      });
      return { allowed: true, used: 0, limit: perHousehold };
    }

    const householdUsed = householdRes.count ?? 0;
    const globalUsed = globalRes.count ?? 0;

    if (householdUsed >= perHousehold) {
      console.warn("[spend-guard] household daily extraction cap hit", {
        householdId: args.householdId,
        used: householdUsed,
        limit: perHousehold,
      });
      return {
        allowed: false,
        scope: "household",
        used: householdUsed,
        limit: perHousehold,
        message:
          "This household has reached its daily limit for document processing. " +
          "Your upload was saved and nothing was lost — it can be processed again tomorrow, " +
          "or reply to support and we'll raise the limit.",
      };
    }

    if (globalUsed >= global) {
      // Deliberately does not tell the user about a platform-wide ceiling.
      console.error("[spend-guard] GLOBAL daily extraction cap hit", {
        used: globalUsed,
        limit: global,
      });
      return {
        allowed: false,
        scope: "global",
        used: globalUsed,
        limit: global,
        message:
          "Document processing is temporarily paused. Your upload was saved and " +
          "nothing was lost — it will be processed shortly.",
      };
    }

    return { allowed: true, used: householdUsed, limit: perHousehold };
  } catch (err) {
    console.error("[spend-guard] threw, allowing through", err);
    return { allowed: true, used: 0, limit: perHousehold };
  }
}
