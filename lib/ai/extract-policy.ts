import "server-only";

import { generateObject } from "ai";

import { getOpenRouter, MODEL_TIER3 } from "@/lib/ai/openrouter";
import {
  policyExtractionSchema,
  type PolicyExtractionResult,
} from "@/lib/ai/policy-schema";
import {
  POLICY_PROMPT_VERSION,
  POLICY_SYSTEM_PROMPT,
} from "@/lib/ai/prompts/policy-v1";

export interface ExtractPolicyOptions {
  fileBytes: Uint8Array;
  mimeType: string;
  filename: string;
}

export interface ExtractPolicyResult {
  result: PolicyExtractionResult;
  model: string;
  promptVersion: string;
  raw: unknown;
}

export class PolicyExtractionError extends Error {
  readonly cause?: unknown;
  readonly lastModel: string;
  constructor(message: string, opts: { lastModel: string; cause?: unknown }) {
    super(message);
    this.name = "PolicyExtractionError";
    this.lastModel = opts.lastModel;
    this.cause = opts.cause;
  }
}

export async function extractPolicy(
  opts: ExtractPolicyOptions,
): Promise<ExtractPolicyResult> {
  const openrouter = getOpenRouter();
  const modelId = MODEL_TIER3;

  try {
    const { object, response } = await generateObject({
      model: openrouter(modelId),
      schema: policyExtractionSchema,
      system: POLICY_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the pet insurance policy fields strictly per the schema. The attached file contains the policy.",
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

    // Bedrock's JSON schema validator doesn't accept `minimum`/`maximum` on
    // numbers — we removed them from the Zod schema and enforce the range
    // here post-extraction. Out-of-range → null (treat as missing).
    const r = object;
    if (r.reimbursement_rate !== null) {
      if (
        !Number.isFinite(r.reimbursement_rate) ||
        r.reimbursement_rate < 0 ||
        r.reimbursement_rate > 1
      ) {
        r.reimbursement_rate = null;
      }
    }
    if (!Number.isFinite(r.confidence_overall)) {
      r.confidence_overall = 0;
    } else {
      r.confidence_overall = Math.max(0, Math.min(1, r.confidence_overall));
    }

    // v1.1 — Drop financial values where the LLM filled the number but
    // skipped the raw_text citation. The whole point of citations is that
    // unverifiable dollar figures shouldn't be persisted; if the model
    // couldn't quote it, treat as missing.
    if (r.premium_monthly_dollars !== null && !r.premium_raw_text?.trim()) {
      r.premium_monthly_dollars = null;
    }
    if (r.deductible_annual_dollars !== null && !r.deductible_raw_text?.trim()) {
      r.deductible_annual_dollars = null;
    }
    if (r.annual_max_dollars !== null && !r.annual_max_raw_text?.trim()) {
      r.annual_max_dollars = null;
    }
    if (r.reimbursement_rate !== null && !r.reimbursement_raw_text?.trim()) {
      r.reimbursement_rate = null;
    }

    return {
      result: r,
      model: modelId,
      promptVersion: POLICY_PROMPT_VERSION,
      raw: response,
    };
  } catch (err) {
    throw new PolicyExtractionError(
      `Policy extraction failed: ${err instanceof Error ? err.message : "unknown"}`,
      { lastModel: modelId, cause: err },
    );
  }
}
