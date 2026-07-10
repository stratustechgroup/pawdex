import { generateObject } from "ai";
import {
  getOpenRouter,
  MODEL_TIER1,
  MODEL_TIER2,
  MODEL_TIER3,
} from "./openrouter";
import {
  extractionResultSchema,
  type ExtractionResult,
} from "./extraction-schema";
import { buildExtractionSystemPrompt } from "./prompts/v1";

type Tier = 1 | 2 | 3;

export interface ExtractDocumentOptions {
  fileBytes: Uint8Array;
  mimeType: string;
  filename: string;
  /** Skip the escalation ladder and run a specific tier directly (e.g. tier 3 for rabies certs). */
  forceTier?: Tier;
  /**
   * Cap the escalation ladder at this tier. Used when a document is too large
   * for tier 3's provider caps (Claude PDF/image limits), we decide up front
   * to stop at tier 2 rather than paying tiers 1-2 then hard-failing at tier 3.
   * Ignored when forceTier is set. Defaults to 3 (full ladder).
   */
  maxTier?: Tier;
  /**
   * Format-specific prompt fragments (PIMS guidance, Form 51 anchoring) to
   * append to the core system prompt. Produced by the text pre-pass +
   * classifiers in extraction-trigger. Empty/absent → core prompt only.
   */
  promptFragments?: string[];
  /** Tier 1 only. When undefined or true, hint the provider to use the Batch API.
   *  See note in runTier — AI SDK has no first-class Batch primitive yet, so this
   *  is currently a provider hint only. */
  useBatch?: boolean;
}

export interface ExtractDocumentResult {
  tier: Tier;
  result: ExtractionResult;
  model: string;
  raw: unknown;
}

const CONFIDENCE_FLOOR = 0.85;

export class ExtractionError extends Error {
  public readonly attempts: number;
  public readonly lastModel: string;
  public readonly cause?: unknown;

  constructor(
    message: string,
    opts: { attempts: number; lastModel: string; cause?: unknown },
  ) {
    super(message);
    this.name = "ExtractionError";
    this.attempts = opts.attempts;
    this.lastModel = opts.lastModel;
    this.cause = opts.cause;
  }
}

interface AttemptOutcome {
  ok: boolean;
  result?: ExtractionResult;
  raw?: unknown;
  /** Reason this attempt is being escalated past, even if `ok` is true (e.g. low confidence). */
  reason?: string;
  error?: unknown;
}

/**
 * v6.1 — Distil a runTier failure into a compact hint the next tier model
 * can act on. Zod parse failures carry detailed path/message info that helps
 * a stronger model avoid the same trap; provider errors are noise we strip.
 */
function summarizeFailureForNextTier(err: unknown): string | undefined {
  if (!err) return undefined;
  const msg = err instanceof Error ? err.message : String(err);

  // Zod parse failures from generateObject include the offending path in
  // the error message. Pluck the most informative ~200 chars.
  if (msg.includes("Type validation") || msg.includes("ZodError")) {
    return `Schema validation failed: ${msg.slice(0, 200)}`;
  }

  // Confidence-floor escalation messages already arrive shaped — pass
  // through verbatim.
  if (msg.startsWith("confidence_overall")) {
    return msg;
  }

  // Provider/transport failures aren't actionable for the next-tier model —
  // they'd indicate "the network was flaky" not "you made a mistake."
  // Suppress these so we don't prime the next tier with irrelevant noise.
  return undefined;
}

function modelForTier(tier: Tier): string {
  switch (tier) {
    case 1:
      return MODEL_TIER1;
    case 2:
      return MODEL_TIER2;
    case 3:
      return MODEL_TIER3;
  }
}

async function runTier(
  tier: Tier,
  opts: ExtractDocumentOptions,
  priorFailureHint?: string,
): Promise<AttemptOutcome> {
  const openrouter = getOpenRouter();
  const modelId = modelForTier(tier);

  // Tier 1 Batch API hint. AI SDK 6 does not yet expose first-class Batch
  // submission for OpenRouter (Batch is a request-shape on the OpenRouter REST
  // API, not a generateObject mode). When that lands, swap this hint for the
  // real batch flow. For now the call is synchronous; the hint is harmless if
  // OpenRouter ignores it.
  const callBatchHint =
    tier === 1 && opts.useBatch !== false
      ? { openrouter: { use_batch: true } }
      : undefined;

  // v6.1 — Tier-aware escalation: when a previous tier failed Zod parsing or
  // confidence-floor, include the failure reason in the user message so the
  // next tier knows what to do differently. The schema description is still
  // in the system prompt; the failure hint here primes attention.
  const userText = priorFailureHint
    ? `Extract structured data from the attached veterinary document. Filename: ${opts.filename}\n\nIMPORTANT: A previous extraction attempt by a smaller model failed. The failure reason was:\n${priorFailureHint}\n\nPlease be especially careful about that issue. If a field is genuinely not in the document, leave it null rather than fabricating.`
    : `Extract structured data from the attached veterinary document. Filename: ${opts.filename}`;

  try {
    const { object, response } = await generateObject({
      model: openrouter(modelId),
      schema: extractionResultSchema,
      providerOptions: callBatchHint,
      // System prompt goes at the top level — keeps it out of the messages
      // array (per AI SDK warning) and lets providers cache it natively. The
      // core is stable (cache-friendly); detected fragments append after it.
      system: buildExtractionSystemPrompt(opts.promptFragments),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userText,
            },
            {
              type: "file",
              data: opts.fileBytes,
              mediaType: opts.mimeType,
              filename: opts.filename,
            },
          ],
        },
      ],
    });

    if (object.confidence_overall < CONFIDENCE_FLOOR) {
      return {
        ok: true,
        result: object,
        raw: response,
        reason: `confidence_overall ${object.confidence_overall.toFixed(2)} below floor ${CONFIDENCE_FLOOR}`,
      };
    }

    return { ok: true, result: object, raw: response };
  } catch (err) {
    // Surface the real reason — without this we can't tell whether the failure
    // is model-side (unsupported file type, schema rejection) or provider-side
    // (rate limit, model ID typo). Logged on the server only.
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(
      `[extract-document] Tier ${tier} (${modelId}) failed: ${msg}`,
      stack ? `\n${stack.split("\n").slice(0, 6).join("\n")}` : "",
    );
    return { ok: false, error: err };
  }
}

export async function extractDocument(
  opts: ExtractDocumentOptions,
): Promise<ExtractDocumentResult> {
  // forceTier short-circuits the ladder entirely. Used for high-stakes
  // documents (rabies certificates) where we don't want to pay tier 1/2 first.
  if (opts.forceTier) {
    const outcome = await runTier(opts.forceTier, opts);
    if (outcome.ok && outcome.result) {
      return {
        tier: opts.forceTier,
        result: outcome.result,
        model: modelForTier(opts.forceTier),
        raw: outcome.raw,
      };
    }
    throw new ExtractionError(
      `Forced tier ${opts.forceTier} extraction failed`,
      {
        attempts: 1,
        lastModel: modelForTier(opts.forceTier),
        cause: outcome.error,
      },
    );
  }

  // Cap the ladder when a size-aware caller (extraction-trigger) already knows
  // tier 3 would 400 on this document's byte size. Stopping at the cap up front
  // avoids paying tiers 1-2 only to hard-fail at tier 3.
  const maxTier: Tier = opts.maxTier ?? 3;
  const ladder: Tier[] = ([1, 2, 3] as Tier[]).filter((t) => t <= maxTier);
  const terminalTier = ladder[ladder.length - 1];
  let attempts = 0;
  let lastError: unknown = undefined;
  let lastModel = modelForTier(ladder[0]);
  // v6.1 — Track the hint to feed to the next tier when escalation happens.
  // We pass a compact one-line summary, not the full error object/stack —
  // the next-tier model needs the failure reason, not the JS internals.
  let priorFailureHint: string | undefined = undefined;

  for (const tier of ladder) {
    attempts += 1;
    lastModel = modelForTier(tier);
    const outcome = await runTier(tier, opts, priorFailureHint);

    // Escalate on hard failure (Zod parse / network / provider error).
    if (!outcome.ok || !outcome.result) {
      lastError = outcome.error;
      priorFailureHint = summarizeFailureForNextTier(outcome.error);
      continue;
    }

    // Escalate on soft failure (confidence below floor), unless we're already
    // at the terminal tier (which may be the size-capped tier 2, not tier 3).
    if (outcome.reason && tier !== terminalTier) {
      lastError = new Error(outcome.reason);
      priorFailureHint = outcome.reason;
      continue;
    }

    return {
      tier,
      result: outcome.result,
      model: modelForTier(tier),
      raw: outcome.raw,
    };
  }

  throw new ExtractionError(
    "All extraction tiers failed to produce a confident, schema-valid result",
    { attempts, lastModel, cause: lastError },
  );
}
