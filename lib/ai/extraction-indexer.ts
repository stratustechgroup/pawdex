import "server-only";

import { embedTexts } from "@/lib/ai/embeddings";
import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/types";

type Chunk = {
  content: string;
  source_path: string;
  pet_id: string | null;
};

const MAX_CHUNK_CHARS = 1800;

// Doc Q&A is an optional feature — without OPENAI_API_KEY the embedder
// (lib/ai/embeddings.ts) throws on every commit. We don't want a 5-line stack
// trace logged for every extraction commit just because the key isn't set, so
// flag the absence once and silently skip indexing thereafter. Wrapped in an
// object so the `prefer-const` autofixer leaves the mutability alone.
const warnState = { missingKeyLogged: false };

/**
 * Builds a list of self-contained text chunks from a committed extraction so
 * each row is independently embeddable and citable. The shape mirrors what
 * the extraction schema produces, but we accept `unknown`/`Json` here so the
 * indexer doesn't have to track every prompt-version schema revision.
 */
function buildChunks(args: {
  petId: string;
  rawResponse: Json;
}): Chunk[] {
  const chunks: Chunk[] = [];
  const raw = args.rawResponse as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") return chunks;

  // The envelope in document_extractions.raw_response wraps the actual
  // extracted object in `result`. Fall back to the root if not wrapped.
  const result =
    (raw.result as Record<string, unknown> | undefined) ??
    (raw as Record<string, unknown>);

  // Sections — each is a self-contained block.
  const sections = result.sections;
  if (Array.isArray(sections)) {
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i] as Record<string, unknown>;
      const title = String(s.title ?? `Section ${i + 1}`);
      const summary = String(s.summary ?? "");
      const date = s.date_hint ? `Date: ${s.date_hint}. ` : "";
      const content = `${title}. ${date}${summary}`.trim();
      if (content.length > 0) {
        chunks.push({
          content: cap(content, MAX_CHUNK_CHARS),
          source_path: `sections[${i}]`,
          pet_id: args.petId,
        });
      }
    }
  }

  // Vaccinations — flatten each into a single chunk with key facts.
  if (Array.isArray(result.vaccinations)) {
    for (let i = 0; i < result.vaccinations.length; i++) {
      const v = result.vaccinations[i] as Record<string, unknown>;
      const parts = [
        `Vaccination: ${v.vaccine_type ?? "(unknown type)"}`,
        v.administered_on ? `administered on ${v.administered_on}` : null,
        v.expires_on ? `expires ${v.expires_on}` : null,
        v.lot_number ? `lot ${v.lot_number}` : null,
        v.manufacturer ? `manufacturer ${v.manufacturer}` : null,
        v.administering_vet ? `administered by ${v.administering_vet}` : null,
        v.clinic_name ? `at ${v.clinic_name}` : null,
      ].filter(Boolean);
      chunks.push({
        content: cap(parts.join(". "), MAX_CHUNK_CHARS),
        source_path: `vaccinations[${i}]`,
        pet_id: args.petId,
      });
    }
  }

  // Medications — same flattening pattern.
  if (Array.isArray(result.medications)) {
    for (let i = 0; i < result.medications.length; i++) {
      const m = result.medications[i] as Record<string, unknown>;
      const parts = [
        `Medication: ${m.name ?? "(unknown)"}`,
        m.generic_name && m.generic_name !== m.name
          ? `(generic ${m.generic_name})`
          : null,
        m.dose ? `dose ${m.dose}` : null,
        m.route ? `route ${m.route}` : null,
        m.frequency ? `frequency ${m.frequency}` : null,
        m.duration_days ? `${m.duration_days} day course` : null,
        m.started_on ? `started ${m.started_on}` : null,
        m.ended_on ? `ended ${m.ended_on}` : null,
        m.indication ? `for ${m.indication}` : null,
        m.medication_context ? `context: ${m.medication_context}` : null,
        m.prescriber ? `prescribed by ${m.prescriber}` : null,
      ].filter(Boolean);
      chunks.push({
        content: cap(parts.join(". "), MAX_CHUNK_CHARS),
        source_path: `medications[${i}]`,
        pet_id: args.petId,
      });
    }
  }

  // Medical events — title + summary + diagnosis.
  if (Array.isArray(result.medical_events)) {
    for (let i = 0; i < result.medical_events.length; i++) {
      const e = result.medical_events[i] as Record<string, unknown>;
      const parts = [
        `Visit: ${e.title ?? "(untitled)"}`,
        e.occurred_on ? `on ${e.occurred_on}` : null,
        e.event_type ? `type ${e.event_type}` : null,
        e.diagnosis ? `diagnosis: ${e.diagnosis}` : null,
        e.treatment ? `treatment: ${e.treatment}` : null,
        e.summary ? `\nSummary: ${e.summary}` : null,
      ].filter(Boolean);
      chunks.push({
        content: cap(parts.join(". "), MAX_CHUNK_CHARS),
        source_path: `medical_events[${i}]`,
        pet_id: args.petId,
      });
    }
  }

  // Weights — small chunks but useful for "what was Bailey's last weight?"
  if (Array.isArray(result.weights)) {
    for (let i = 0; i < result.weights.length; i++) {
      const w = result.weights[i] as Record<string, unknown>;
      const parts = [
        "Weight measurement",
        w.recorded_on ? `on ${w.recorded_on}` : null,
        w.weight_kg ? `${w.weight_kg} kg` : null,
        w.weight_lbs ? `${w.weight_lbs} lbs` : null,
      ].filter(Boolean);
      chunks.push({
        content: cap(parts.join(": "), 400),
        source_path: `weights[${i}]`,
        pet_id: args.petId,
      });
    }
  }

  // Notes — single chunk for any free-form catch-all.
  if (typeof result.notes === "string" && result.notes.trim().length > 0) {
    chunks.push({
      content: cap(`Notes: ${result.notes.trim()}`, MAX_CHUNK_CHARS),
      source_path: "notes",
      pet_id: args.petId,
    });
  }

  return chunks;
}

function cap(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/**
 * Format a number[] as a pgvector text literal: '[0.123,0.456,...]'.
 */
function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

/**
 * Embed the extraction's content and persist the chunks. Idempotent:
 * deletes prior chunks for the same (household, document) before inserting
 * fresh ones so re-running on the same document doesn't pile up duplicates.
 *
 * Designed to be called from `after()` post-commit — best-effort, errors
 * are logged but never bubbled. The product still works without doc Q&A.
 */
export async function indexExtractionForQa(args: {
  householdId: string;
  documentId: string;
  extractionId: string;
  petId: string;
  rawResponse: Json;
}): Promise<{ chunks_written: number }> {
  // Bail before doing any work when the embedding key isn't set — doc Q&A
  // is an optional feature, no need to noisily fail on every commit.
  if (!process.env.OPENAI_API_KEY) {
    if (!warnState.missingKeyLogged) {
      console.info(
        "[indexExtractionForQa] OPENAI_API_KEY not set — skipping doc Q&A indexing. Set it in .env.local to enable.",
      );
      warnState.missingKeyLogged = true;
    }
    return { chunks_written: 0 };
  }

  const supabase = createServiceClient();

  let chunks: Chunk[] = [];
  try {
    chunks = buildChunks({ petId: args.petId, rawResponse: args.rawResponse });
  } catch (err) {
    console.error("[indexExtractionForQa] buildChunks failed", err);
    return { chunks_written: 0 };
  }
  if (chunks.length === 0) return { chunks_written: 0 };

  let embeddings: number[][] = [];
  try {
    embeddings = await embedTexts(chunks.map((c) => c.content));
  } catch (err) {
    console.error("[indexExtractionForQa] embedTexts failed", err);
    return { chunks_written: 0 };
  }
  if (embeddings.length !== chunks.length) {
    console.error(
      "[indexExtractionForQa] embedding count mismatch — got",
      embeddings.length,
      "want",
      chunks.length,
    );
    return { chunks_written: 0 };
  }

  // Idempotency — wipe prior chunks for this document.
  await supabase
    .from("extraction_chunks")
    .delete()
    .eq("household_id", args.householdId)
    .eq("document_id", args.documentId);

  const rows = chunks.map((c, i) => ({
    household_id: args.householdId,
    document_id: args.documentId,
    extraction_id: args.extractionId,
    pet_id: c.pet_id,
    source_path: c.source_path,
    content: c.content,
    embedding: toVectorLiteral(embeddings[i]),
  }));

  const { error } = await supabase.from("extraction_chunks").insert(rows);
  if (error) {
    console.error("[indexExtractionForQa] insert failed", error.message);
    return { chunks_written: 0 };
  }

  return { chunks_written: rows.length };
}
