import "server-only";

import { generateText } from "ai";

import { embedText } from "@/lib/ai/embeddings";
import { getOpenRouter, MODEL_TIER3 } from "@/lib/ai/openrouter";
import { createClient } from "@/lib/supabase/server";

const TOP_K_DEFAULT = 8;

export type QaCitation = {
  index: number; // 1-based as shown in the answer
  document_id: string;
  pet_id: string | null;
  pet_name: string | null;
  source_path: string | null;
  similarity: number;
  snippet: string;
};

export type QaAnswer = {
  answer: string;
  citations: QaCitation[];
  used_model: string;
  retrieved: number;
};

type MatchRow = {
  id: string;
  document_id: string;
  pet_id: string | null;
  source_path: string | null;
  content: string;
  similarity: number;
};

function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

const SYSTEM_PROMPT = `You are Pawdex's veterinary records assistant. Answer the owner's question STRICTLY from the provided record snippets. Each snippet is prefixed with [#N] — when you use a fact from snippet N, cite it inline as [#N].

Rules:
- Never invent facts. If the snippets don't contain the answer, say so plainly and suggest what document or visit might have it.
- Use the owner's own language — direct, plain English. No vet jargon without translation.
- Dates: prefer ISO dates from the snippets verbatim. If multiple snippets disagree, note the discrepancy.
- Never give medical advice — frame interpretation as "ask your vet to confirm" when relevant.
- Brief is better. 2–4 sentences for most questions. Lists are fine when comparing multiple records.
- Always end with a "Citations:" section listing every [#N] you referenced, on separate lines.`;

export async function answerHouseholdQuestion(input: {
  householdId: string;
  question: string;
  topK?: number;
}): Promise<QaAnswer> {
  const question = input.question.trim();
  if (!question) {
    return {
      answer: "Ask me something specific — like 'when is Bailey's rabies due?' or 'what was the last creatinine reading?'",
      citations: [],
      used_model: "(skipped)",
      retrieved: 0,
    };
  }

  // Use the auth-bearing server client so the RPC's defensive
  // auth.uid()-based household-membership check passes.
  const supabase = await createClient();
  const queryEmbedding = await embedText(question);

  const { data: matchData, error: matchErr } = await supabase.rpc(
    "match_extraction_chunks",
    {
      query_embedding: toVectorLiteral(queryEmbedding),
      match_count: input.topK ?? TOP_K_DEFAULT,
      p_household_id: input.householdId,
    },
  );

  if (matchErr) {
    throw new Error(`match_extraction_chunks: ${matchErr.message}`);
  }

  const matches = (matchData ?? []) as MatchRow[];
  if (matches.length === 0) {
    return {
      answer:
        "I don't have anything indexed yet that matches that. Once you commit a document review, the entries become searchable here.",
      citations: [],
      used_model: "(skipped)",
      retrieved: 0,
    };
  }

  // Pull pet names for citation labels in a single round-trip.
  const petIds = Array.from(
    new Set(matches.map((m) => m.pet_id).filter((p): p is string => !!p)),
  );
  const petNameById = new Map<string, string>();
  if (petIds.length > 0) {
    const { data: pets } = await supabase
      .from("pets")
      .select("id, name")
      .in("id", petIds);
    for (const p of pets ?? []) petNameById.set(p.id, p.name);
  }

  const citations: QaCitation[] = matches.map((m, i) => ({
    index: i + 1,
    document_id: m.document_id,
    pet_id: m.pet_id,
    pet_name: m.pet_id ? (petNameById.get(m.pet_id) ?? null) : null,
    source_path: m.source_path,
    similarity: m.similarity,
    snippet: m.content,
  }));

  const contextBlock = citations
    .map(
      (c) =>
        `[#${c.index}]${c.pet_name ? ` (${c.pet_name})` : ""}${c.source_path ? ` ${c.source_path}` : ""}\n${c.snippet}`,
    )
    .join("\n\n");

  const openrouter = getOpenRouter();
  const { text } = await generateText({
    model: openrouter(MODEL_TIER3),
    system: SYSTEM_PROMPT,
    prompt: `Question: ${question}\n\nRecord snippets:\n${contextBlock}\n\nAnswer (cite using [#N] inline, then list Citations):`,
  });

  return {
    answer: text.trim(),
    citations,
    used_model: MODEL_TIER3,
    retrieved: matches.length,
  };
}
