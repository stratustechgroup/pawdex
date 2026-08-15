/**
 * Happy-path test for doc Q&A indexing + retrieval.
 *
 * Everything else in the suite proves indexing fails SAFELY (a broken embed
 * can't break a commit). This proves it actually WORKS: that
 * indexExtractionForQa writes chunks, that the vectors land in a shape
 * match_extraction_chunks can search, and that a semantically related question
 * retrieves the right chunk.
 *
 * Run: pnpm dlx tsx --tsconfig scripts/tsconfig.scripts.json scripts/test-qa-index-e2e.ts
 *
 * SAFETY
 *   - Creates one ZZTEST household + pet + document + extraction, all deleted
 *     in a finally block. Never touches real data; every write is scoped to the
 *     household id it just created.
 *   - Real embedding calls: 3 (two index passes + one query). Cents at most.
 */
import { readFileSync } from "node:fs";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  const k = line.slice(0, i).trim();
  if (!(k in process.env)) process.env[k] = line.slice(i + 1).trim();
}

let pass = 0;
let fail = 0;
function assert(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` (${detail})` : ""}`);
  if (ok) pass++;
  else fail++;
}

const RAW_RESPONSE = {
  result: {
    sections: [
      {
        title: "Annual wellness exam",
        date_hint: "2026-05-01",
        summary:
          "Patient presented bright, alert and responsive. Body condition score 5/9. Dental tartar noted on upper premolars; cleaning recommended within six months.",
      },
    ],
    vaccinations: [
      {
        vaccine_type: "Rabies",
        administered_on: "2026-05-01",
        expires_on: "2029-05-01",
        lot_number: "ZZ-TEST-4417",
        manufacturer: "Zoetis",
        administering_vet: "Dr. Testerson",
      },
    ],
    medications: [
      {
        name: "Apoquel",
        dose: "16mg",
        route: "oral",
        frequency: "twice daily",
        indication: "allergic dermatitis",
      },
    ],
  },
};

async function main() {
  const { randomUUID } = await import("node:crypto");
  const { createClient } = await import("@supabase/supabase-js");
  const { indexExtractionForQa } = await import("../lib/ai/extraction-indexer");
  const { embedTexts } = await import("../lib/ai/embeddings");

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let householdId = "";
  let petId = "";
  let documentId = "";
  let extractionId = "";
  let userId = "";

  try {
    // match_extraction_chunks is security-invoker and checks household
    // membership against auth.uid(), so retrieval must be exercised as a real
    // authenticated user. A service-role client has no auth.uid() and would
    // silently retrieve nothing.
    const password = `ZZ${randomUUID()}`;
    const email = `zztest-qa-index+${Date.now()}@zzpawdextest-nx.io`;
    const { data: userRes, error: userErr } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (userErr || !userRes?.user) throw new Error(`createUser: ${userErr?.message}`);
    userId = userRes.user.id;

    const { data: hh, error: hhErr } = await sb
      .from("households")
      .insert({ name: "ZZTEST qa-index", created_by: userId })
      .select("id")
      .single();
    if (hhErr) throw new Error(`household insert: ${hhErr.message}`);
    householdId = hh.id;
    console.log(`ZZTEST household ${householdId}\n`);

    const { error: memErr } = await sb
      .from("household_members")
      .insert({ household_id: householdId, user_id: userId, role: "owner" });
    if (memErr) throw new Error(`membership insert: ${memErr.message}`);

    const { data: pet, error: petErr } = await sb
      .from("pets")
      .insert({ household_id: householdId, name: "ZZTEST Indexer", species: "dog" })
      .select("id")
      .single();
    if (petErr) throw new Error(`pet insert: ${petErr.message}`);
    petId = pet.id;

    const { data: doc, error: docErr } = await sb
      .from("documents")
      .insert({
        household_id: householdId,
        pet_id: petId,
        storage_path: `zztest/${householdId}/qa-index.pdf`,
        original_filename: "zztest-qa-index.pdf",
        doc_type: "vaccine_certificate",
        processing_status: "confirmed",
      })
      .select("id")
      .single();
    if (docErr) throw new Error(`document insert: ${docErr.message}`);
    documentId = doc.id;

    const { data: ext, error: extErr } = await sb
      .from("document_extractions")
      .insert({
        document_id: documentId,
        household_id: householdId,
        model: "zztest",
        prompt_version: "zztest",
        raw_response: RAW_RESPONSE,
        status: "committed",
      })
      .select("id")
      .single();
    if (extErr) throw new Error(`extraction insert: ${extErr.message}`);
    extractionId = ext.id;

    console.log("1. indexing writes chunks");
    const { chunks_written } = await indexExtractionForQa({
      householdId,
      documentId,
      extractionId,
      petId,
      rawResponse: RAW_RESPONSE as never,
    });
    assert("indexExtractionForQa wrote chunks", chunks_written > 0, `chunks_written=${chunks_written}`);

    const { count: persisted } = await sb
      .from("extraction_chunks")
      .select("id", { head: true, count: "exact" })
      .eq("household_id", householdId);
    assert("chunks persisted to the table", (persisted ?? 0) === chunks_written, `rows=${persisted}`);

    console.log("\n2. re-indexing is idempotent (replaces, not duplicates)");
    await indexExtractionForQa({
      householdId,
      documentId,
      extractionId,
      petId,
      rawResponse: RAW_RESPONSE as never,
    });
    const { count: afterReindex } = await sb
      .from("extraction_chunks")
      .select("id", { head: true, count: "exact" })
      .eq("household_id", householdId);
    assert("re-index does not duplicate", afterReindex === persisted, `rows=${afterReindex}`);

    console.log("\n3. retrieval finds the right chunk (as the authenticated owner)");
    const authed = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { error: signInErr } = await authed.auth.signInWithPassword({ email, password });
    if (signInErr) throw new Error(`signIn: ${signInErr.message}`);

    const [queryVec] = await embedTexts(["When does the rabies vaccine expire?"]);
    const queryLiteral = `[${queryVec.join(",")}]`;
    const { data: matches, error: matchErr } = await authed.rpc("match_extraction_chunks", {
      query_embedding: queryLiteral,
      match_count: 3,
      p_household_id: householdId,
    });
    assert("match_extraction_chunks executed", !matchErr, matchErr?.message ?? "");
    const rows = (matches ?? []) as { content: string; similarity: number }[];
    assert("retrieval returned matches", rows.length > 0, `got ${rows.length}`);
    const top = rows[0]?.content ?? "";
    assert("top match is the rabies chunk", /rabies/i.test(top), top.slice(0, 70));
    assert(
      "top match has a meaningful similarity",
      (rows[0]?.similarity ?? 0) > 0.3,
      `similarity=${rows[0]?.similarity?.toFixed(3)}`,
    );

    console.log("\n4. tenant isolation (non-vacuous — the chunks DO exist)");
    const { data: otherMatches } = await authed.rpc("match_extraction_chunks", {
      query_embedding: queryLiteral,
      match_count: 3,
      p_household_id: "00000000-0000-0000-0000-000000000000",
    });
    assert(
      "a household the user doesn't belong to retrieves nothing",
      ((otherMatches ?? []) as unknown[]).length === 0,
      `got ${((otherMatches ?? []) as unknown[]).length}`,
    );

    const svcRows = await sb.rpc("match_extraction_chunks", {
      query_embedding: queryLiteral,
      match_count: 3,
      p_household_id: householdId,
    });
    assert(
      "service-role (no auth.uid()) retrieves nothing — membership check holds",
      ((svcRows.data ?? []) as unknown[]).length === 0,
      `got ${((svcRows.data ?? []) as unknown[]).length}`,
    );
  } finally {
    if (householdId) {
      await sb.from("extraction_chunks").delete().eq("household_id", householdId);
      await sb.from("households").delete().eq("id", householdId);
      const { count: leftover } = await sb
        .from("extraction_chunks")
        .select("id", { head: true, count: "exact" })
        .eq("household_id", householdId);
      console.log(`\ncleanup: household removed, ${leftover ?? 0} chunk(s) left behind`);
    }
    if (userId) {
      await sb.auth.admin.deleteUser(userId);
      console.log(`cleanup: ZZTEST user ${userId.slice(0, 8)} deleted`);
    }
  }

  console.log(`\nqa index e2e: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

void main();
