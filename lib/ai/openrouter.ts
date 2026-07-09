import { createOpenRouter } from "@openrouter/ai-sdk-provider";

// Tier constants. Read once at module load — env mutation post-boot won't change them.
// Tiers map to the escalation ladder in extract-document.ts:
//   1 = cheap/fast first pass, 2 = mid-quality retry, 3 = high-stakes (rabies certs, etc.).
// Defaults pick model IDs that are currently live on OpenRouter. Override via
// env vars when newer Sonnet/Gemini versions land on OpenRouter's catalog.
// Verify availability at https://openrouter.ai/models if a tier 404s.
export const MODEL_TIER1 =
  process.env.OPENROUTER_MODEL_TIER1 ?? "google/gemini-2.5-flash-lite";
export const MODEL_TIER2 =
  process.env.OPENROUTER_MODEL_TIER2 ?? "google/gemini-2.5-flash";
export const MODEL_TIER3 =
  process.env.OPENROUTER_MODEL_TIER3 ?? "anthropic/claude-sonnet-4.5";

type OpenRouterProvider = ReturnType<typeof createOpenRouter>;

let cached: OpenRouterProvider | null = null;

export function getOpenRouter(): OpenRouterProvider {
  if (cached) return cached;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      "OPENROUTER_API_KEY is required but missing. Set it in .env.local.",
    );
  }

  cached = createOpenRouter({
    apiKey,
    appName: process.env.OPENROUTER_APP_NAME,
    appUrl: process.env.OPENROUTER_REFERRER,
  });

  return cached;
}
