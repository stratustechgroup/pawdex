import "server-only";

// 1536-dim embeddings via text-embedding-3-small, routed through OpenRouter's
// OpenAI-compatible embeddings endpoint so the whole AI path uses one vendor
// and one key (the same OPENROUTER_API_KEY the extraction and Q&A calls use).
// The model id is provider-prefixed for OpenRouter's catalog. Cost is ~$0.02
// per million tokens, negligible next to the LLM calls already on the path.

const EMBEDDING_MODEL =
  process.env.OPENROUTER_EMBEDDING_MODEL ??
  process.env.OPENAI_EMBEDDING_MODEL ??
  "openai/text-embedding-3-small";
const EMBEDDING_API_URL =
  process.env.OPENROUTER_EMBEDDING_URL ??
  "https://openrouter.ai/api/v1/embeddings";
const DEFAULT_DIMENSIONS = 1536;

type EmbeddingResponse = {
  data: { embedding: number[]; index: number }[];
  model: string;
  usage?: { prompt_tokens: number; total_tokens: number };
};

export class EmbeddingError extends Error {
  readonly cause: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "EmbeddingError";
    this.cause = cause;
  }
}

export async function embedTexts(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return [];

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new EmbeddingError(
      "OPENROUTER_API_KEY is not configured — set it to enable doc Q&A indexing.",
    );
  }

  // Cap individual input length to avoid the 8191-token model limit. ~32k chars
  // ≈ 8k tokens for English prose. We over-trim to leave headroom.
  const cleaned = inputs.map((s) =>
    s.length > 24000 ? s.slice(0, 24000) : s,
  );

  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${apiKey}`,
  };
  // Mirror the attribution headers the chat client sends to OpenRouter.
  if (process.env.OPENROUTER_REFERRER) {
    headers["HTTP-Referer"] = process.env.OPENROUTER_REFERRER;
  }
  if (process.env.OPENROUTER_APP_NAME) {
    headers["X-Title"] = process.env.OPENROUTER_APP_NAME;
  }

  const res = await fetch(EMBEDDING_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: cleaned,
      dimensions: DEFAULT_DIMENSIONS,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new EmbeddingError(
      `OpenRouter embedding API ${res.status}: ${text.slice(0, 400)}`,
    );
  }

  const body = (await res.json()) as EmbeddingResponse;
  // The API guarantees data sorted by `index`, but assert defensively.
  return body.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

export async function embedText(input: string): Promise<number[]> {
  const [vec] = await embedTexts([input]);
  return vec ?? [];
}
