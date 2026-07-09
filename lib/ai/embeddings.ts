import "server-only";

// 1536-dim embeddings via OpenAI's text-embedding-3-small. We hit the OpenAI
// REST endpoint directly to avoid pulling in another SDK. Cost is ~$0.02 per
// million tokens — negligible relative to the LLM calls already on the path.

const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
const EMBEDDING_API_URL = "https://api.openai.com/v1/embeddings";
const DEFAULT_DIMENSIONS = 1536;

type OpenAIEmbeddingResponse = {
  data: { embedding: number[]; index: number }[];
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new EmbeddingError(
      "OPENAI_API_KEY is not configured — set it in .env.local to enable doc Q&A indexing.",
    );
  }

  // Cap individual input length to avoid the 8191-token model limit. ~32k chars
  // ≈ 8k tokens for English prose. We over-trim to leave headroom.
  const cleaned = inputs.map((s) =>
    s.length > 24000 ? s.slice(0, 24000) : s,
  );

  const res = await fetch(EMBEDDING_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: cleaned,
      dimensions: DEFAULT_DIMENSIONS,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new EmbeddingError(
      `OpenAI embedding API ${res.status}: ${text.slice(0, 400)}`,
    );
  }

  const body = (await res.json()) as OpenAIEmbeddingResponse;
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
