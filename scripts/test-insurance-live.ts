/**
 * End-to-end verification for the insurance feature surface, run against the
 * live Supabase project and the real OpenRouter key.
 *
 * Run with: pnpm dlx tsx scripts/test-insurance-live.ts
 *
 * SAFETY
 *   - Everything it writes is namespaced under a throwaway ZZTEST household +
 *     ZZTEST auth user created at the top and DELETED in a finally block. It
 *     asserts up front that its household id differs from every pre-existing
 *     household, and it never touches rows it did not create.
 *   - Real LLM calls: a small handful (policy extraction, one clarification
 *     draft, one PEC refine). Uses the tiers already wired in lib/ai.
 *   - RESEND_API_KEY is empty in this environment; the graceful no-key path is
 *     asserted, and the send HTTP layer is exercised with a scoped fetch stub
 *     (only api.resend.com is intercepted; Supabase/OpenRouter pass through).
 *
 * WHY THE SHIMS BELOW
 *   Several modules under test begin with `import "server-only"` (a Next
 *   bundler virtual module) and the outbound auth gate resolves through
 *   `@/lib/supabase/server`, whose createClient reads request cookies via
 *   next/headers. Neither exists outside a Next request. We therefore:
 *     (1) neutralize `server-only` / `client-only`, and
 *     (2) substitute `@/lib/supabase/server`'s createClient with a service
 *         client for the duration of the run. That is faithful for the
 *         authorization GATING logic we test here (grant present vs absent,
 *         filtered by household_id) - it returns the exact rows the owner's
 *         RLS-scoped read would. Cross-household RLS is verified separately in
 *         section 7 against the real anon client.
 */

import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts } from "pdf-lib";

// ---------------------------------------------------------------------------
// Module shims (installed before any dynamic import of the modules under test)
// ---------------------------------------------------------------------------
const nreq = createRequire(import.meta.url);
const Mod = nreq("module") as { _load: (...a: unknown[]) => unknown };
const origLoad = Mod._load;
// Lazily-set override so getEffectiveAuthorization runs against a service client.
let serverClientOverride: null | (() => Promise<unknown>) = null;
Mod._load = function patchedLoad(...args: unknown[]) {
  const request = args[0] as string;
  const rest = args.slice(1);
  if (request === "server-only" || request === "client-only") return {};
  if (request === "@/lib/supabase/server") {
    return {
      createClient: async () => {
        if (!serverClientOverride)
          throw new Error("server client override not installed yet");
        return serverClientOverride();
      },
    };
  }
  return origLoad.call(this, request, ...rest);
};

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------
let failed = false;
const results: { section: string; label: string; pass: boolean; detail?: string }[] = [];
let currentSection = "";
function section(name: string) {
  currentSection = name;
  console.log("\n" + "=".repeat(72));
  console.log(name);
  console.log("=".repeat(72));
}
function assert(cond: boolean, label: string, detail?: string) {
  results.push({ section: currentSection, label, pass: cond, detail });
  if (cond) {
    console.log(`  PASS  ${label}`);
  } else {
    failed = true;
    console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

async function buildSyntheticPolicyPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const lines = [
    "ZZTEST PET INSURANCE - DECLARATIONS PAGE",
    "",
    "Insurer: ZZTest Assurance Company",
    "Plan: Complete Coverage",
    "Policy Number: ZZTEST-POL-00042",
    "Policy effective date: 2026-01-01",
    "",
    "SCHEDULE OF BENEFITS",
    "Monthly premium: $48.00",
    "Annual deductible: $250.00 (resets every policy year)",
    "Reimbursement: 80% of the actual vet invoice",
    "Annual maximum benefit: $10,000",
    "",
    "PRE-EXISTING CONDITIONS",
    "A pre-existing condition means any illness or injury your pet showed",
    "signs of before the policy effective date. Conditions that manifested",
    "in the 12 months prior to coverage are excluded. However, curable",
    "conditions that have been symptom-free for 180 days may be eligible",
    "for coverage as a new condition. Bilateral conditions such as cranial",
    "cruciate ligament tears are treated as one condition: if one knee is",
    "affected, the other knee is also considered pre-existing.",
    "",
    "EXCLUSIONS",
    "1. Hereditary or congenital conditions including hip dysplasia.",
    "2. Pre-existing conditions.",
    "3. Dental cleanings and preventive dental care.",
    "4. Cosmetic or elective procedures such as ear cropping and tail docking.",
  ];
  const page = doc.addPage([612, 792]);
  let y = 740;
  for (const ln of lines) {
    page.drawText(ln, { x: 48, y, size: 11, font });
    y -= 18;
  }
  return doc.save();
}

async function main() {
  process.loadEnvFile(".env.local");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Dynamic imports AFTER the shims are installed.
  const { createServiceClient } = await import("@/lib/supabase/service");
  const { processPolicyExtraction } = await import("@/lib/ai/policy-trigger");
  const { extractTextSample } = await import("@/lib/ingest/text-prepass");
  const { tagPecSpans } = await import("@/lib/insurance/pec-prefilter");
  const { draftInsurerClarification, sendInsurerClarification } = await import(
    "@/lib/outbound/insurer-clarification"
  );
  const { requestVetQuote } = await import("@/lib/outbound/vet-quote-request");
  const { refinePECAnalysis } = await import("@/lib/ai/pec-refine");
  const { analyzePECForHousehold } = await import("@/lib/db/pec-analysis");
  const { listInsurancePolicies } = await import("@/lib/db/insurance");
  const { AUTHORIZATION_DESCRIPTORS } = await import("@/lib/auth/authorizations");

  const svc = createServiceClient();
  serverClientOverride = async () => svc; // auth gate reads via service client

  // Track everything we create, for cleanup.
  const created = {
    userId: null as string | null,
    householdId: null as string | null,
    storagePaths: [] as string[],
  };

  try {
    // -------------------------------------------------------------------
    section("0. Preflight + seed a throwaway ZZTEST graph");
    // -------------------------------------------------------------------
    const { data: existingHh } = await svc.from("households").select("id");
    const existingIds = new Set((existingHh ?? []).map((h) => h.id));

    const stamp = Date.now();
    const email = `zztest-insurance+${stamp}@example.com`;
    const { data: userRes, error: userErr } = await svc.auth.admin.createUser({
      email,
      password: `ZZ${randomUUID()}`,
      email_confirm: true,
    });
    if (userErr || !userRes?.user) throw new Error(`createUser failed: ${userErr?.message}`);
    created.userId = userRes.user.id;
    const userId = created.userId;

    const { data: hh, error: hhErr } = await svc
      .from("households")
      .insert({ name: `ZZTEST-insurance ${stamp}`, created_by: userId })
      .select("id")
      .single();
    if (hhErr || !hh) throw new Error(`household insert failed: ${hhErr?.message}`);
    created.householdId = hh.id;
    const householdId = created.householdId;
    assert(!existingIds.has(householdId), "test household id is brand-new (not a pre-existing household)");

    await svc.from("household_members").insert({
      household_id: householdId,
      user_id: userId,
      role: "owner",
      accepted_at: new Date().toISOString(),
    });

    const { data: pet } = await svc
      .from("pets")
      .insert({ household_id: householdId, name: "ZZTEST Insurance Pet", species: "dog" })
      .select("id")
      .single();
    const petId = pet!.id;

    const { data: clinic } = await svc
      .from("vet_clinics")
      .insert({
        household_id: householdId,
        name: `ZZTEST Vet Clinic ${stamp}`,
        email: "zztest-vet@example.com",
      })
      .select("id")
      .single();
    const clinicId = clinic!.id;

    const { data: clinicNoEmail } = await svc
      .from("vet_clinics")
      .insert({ household_id: householdId, name: `ZZTEST No-Email Clinic ${stamp}` })
      .select("id")
      .single();
    const clinicNoEmailId = clinicNoEmail!.id;

    const { data: policy } = await svc
      .from("insurance_policies")
      .insert({
        household_id: householdId,
        pet_id: petId,
        insurer_name: "ZZTest Assurance Company",
        plan_name: "Complete Coverage",
        policy_number: "ZZTEST-POL-00042",
        premium_monthly_cents: 4800,
        deductible_annual_cents: 25000,
        reimbursement_rate: 0.8,
        annual_max_cents: 1000000,
        effective_on: "2026-01-01",
        extracted_exclusions: [
          "Hereditary or congenital conditions including hip dysplasia",
          "Pre-existing conditions",
          "Dental cleanings and preventive dental care",
        ],
        created_by: userId,
      })
      .select("id")
      .single();
    const policyId = policy!.id;

    // A household-scoped policy (no pet) to prove the claims guard.
    const { data: hhPolicy } = await svc
      .from("insurance_policies")
      .insert({
        household_id: householdId,
        pet_id: null,
        insurer_name: "ZZTest Household-Scoped",
        created_by: userId,
      })
      .select("id")
      .single();
    const hhPolicyId = hhPolicy!.id;

    await svc.from("medical_events").insert({
      household_id: householdId,
      pet_id: petId,
      event_type: "illness",
      occurred_on: "2026-02-10",
      title: "Hip dysplasia diagnosis (bilateral)",
      diagnosis: "Bilateral hip dysplasia confirmed on radiographs",
      created_by: userId,
    });
    console.log(`  seeded household=${householdId} pet=${petId} policy=${policyId}`);

    // -------------------------------------------------------------------
    section("3a / 4a. Outbound authorization gating - REFUSAL before grant");
    // -------------------------------------------------------------------
    const clarRefusal = await sendInsurerClarification({
      householdId,
      userId,
      insurancePolicyId: policyId,
      recipientEmail: "claims@zztest-insurer.example.com",
      subject: "Policy clarification request - test",
      body: "This is a ZZTEST body long enough to pass validation checks.",
    });
    assert(
      !clarRefusal.ok && clarRefusal.code === "authorization_missing",
      "sendInsurerClarification refuses without insurer_clarification_emails grant",
      JSON.stringify(clarRefusal),
    );

    const quoteRefusal = await requestVetQuote({
      householdId,
      userId,
      petId,
      insurancePolicyId: policyId,
      vetClinicId: clinicId,
      procedureSummary: "ZZTEST: TPLO surgery estimate",
    });
    assert(
      !quoteRefusal.ok && quoteRefusal.code === "authorization_missing",
      "requestVetQuote refuses without records_request_to_vets grant",
      JSON.stringify(quoteRefusal),
    );

    // Grant both authorizations (direct insert mirrors grantAuthorization).
    for (const type of ["insurer_clarification_emails", "records_request_to_vets"] as const) {
      await svc.from("authorizations").insert({
        household_id: householdId,
        authorization_type: type,
        granted_by: userId,
        scope_text: AUTHORIZATION_DESCRIPTORS[type].scopeText,
      });
    }
    console.log("  granted insurer_clarification_emails + records_request_to_vets");

    // -------------------------------------------------------------------
    section("3b. draftInsurerClarification - real LLM draft");
    // -------------------------------------------------------------------
    const draft = await draftInsurerClarification({
      policy: { insurer_name: "ZZTest Assurance Company", plan_name: "Complete Coverage", policy_number: "ZZTEST-POL-00042" },
      ownerName: "Test Owner",
      ownerEmail: email,
      question: "Is bilateral hip dysplasia covered if only one hip was previously noted?",
      policyContext: "Exclusions: Hereditary or congenital conditions including hip dysplasia.",
    });
    console.log(`  subject: ${draft.subject}`);
    console.log(`  body:\n${draft.body.split("\n").map((l) => "    " + l).join("\n")}`);
    assert(typeof draft.subject === "string" && draft.subject.length > 0 && draft.subject.length <= 120, "draft.subject is a valid non-empty subject <=120 chars");
    assert(typeof draft.body === "string" && draft.body.length >= 40, "draft.body is a substantive body (>=40 chars)");
    assert(!/\bI demand\b|\bthis is unfair\b|\bI deserve\b/i.test(draft.body), "draft body is neutral (no demanding/advocacy language)");

    // -------------------------------------------------------------------
    section("3c. sendInsurerClarification - granted, graceful no-key path");
    // -------------------------------------------------------------------
    delete process.env.RESEND_API_KEY; // ensure the no-key branch
    const clarSend = await sendInsurerClarification({
      householdId,
      userId,
      insurancePolicyId: policyId,
      recipientEmail: "claims@zztest-insurer.example.com",
      subject: draft.subject,
      body: draft.body,
    });
    assert(clarSend.ok === true, "sendInsurerClarification returns ok with grant present", JSON.stringify(clarSend));
    let clarOutboundId: string | null = null;
    if (clarSend.ok) {
      clarOutboundId = clarSend.outbound_email_id;
      assert(clarSend.resend_message_id === null, "no resend_message_id on the no-key path");
      const { data: row } = await svc.from("outbound_emails").select("*").eq("id", clarOutboundId).single();
      assert(row?.status === "drafted", "outbound row recorded with status 'drafted' (no-key)", `status=${row?.status}`);
      assert(!!row?.authorization_id, "outbound row carries the authorization_id FK");
      assert(row?.recipient_type === "insurer", "recipient_type = insurer");
      assert(row?.subject === draft.subject && row?.body_text === draft.body, "persisted subject/body match the approved draft");
      assert(row?.template_id === "insurer-clarification.v1", "template_id stamped");
    }

    // -------------------------------------------------------------------
    section("3d. sendInsurerClarification - send HTTP layer via scoped fetch stub");
    // -------------------------------------------------------------------
    {
      process.env.RESEND_API_KEY = "re_zztest_fake_key";
      const captured: { url: string; body: unknown }[] = [];
      const realFetch = globalThis.fetch;
      globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
        const u = typeof input === "string" ? input : (input as Request).url ?? String(input);
        if (u.includes("api.resend.com")) {
          let parsed: unknown = null;
          try { parsed = init?.body ? JSON.parse(init.body as string) : null; } catch { parsed = init?.body; }
          captured.push({ url: u, body: parsed });
          return new Response(JSON.stringify({ id: "zztest-resend-msgid" }), { status: 200, headers: { "content-type": "application/json" } });
        }
        return realFetch(input as string, init);
      }) as typeof fetch;
      try {
        const sent = await sendInsurerClarification({
          householdId,
          userId,
          insurancePolicyId: policyId,
          recipientEmail: "claims@zztest-insurer.example.com",
          subject: draft.subject,
          body: draft.body,
        });
        assert(sent.ok === true, "send returns ok when the (stubbed) Resend call succeeds", JSON.stringify(sent));
        assert(captured.length === 1, "exactly one HTTP call hit api.resend.com", `count=${captured.length}`);
        if (captured.length) {
          const b = captured[0].body as Record<string, unknown>;
          assert(b?.to === "claims@zztest-insurer.example.com" || (Array.isArray(b?.to) && (b.to as string[]).includes("claims@zztest-insurer.example.com")), "stubbed payload has correct recipient", JSON.stringify(b?.to));
          assert(b?.subject === draft.subject, "stubbed payload has correct subject");
          assert(typeof b?.text === "string" && (b.text as string).length >= 40, "stubbed payload carries the body text");
          assert(typeof b?.from === "string" && (b.from as string).endsWith("@pawdex.app"), "from-address falls back to a @pawdex.app sender, not the Resend sandbox", `from=${String(b?.from)}`);
        }
        if (sent.ok) {
          const { data: row } = await svc.from("outbound_emails").select("status, resend_message_id, sent_at").eq("id", sent.outbound_email_id).single();
          assert(row?.status === "sent", "outbound row transitions to 'sent' after successful send", `status=${row?.status}`);
          assert(row?.resend_message_id === "zztest-resend-msgid", "resend_message_id persisted from the response");
        }
      } finally {
        globalThis.fetch = realFetch;
        delete process.env.RESEND_API_KEY;
      }
    }

    // -------------------------------------------------------------------
    section("4b. requestVetQuote - granted, graceful no-key path");
    // -------------------------------------------------------------------
    delete process.env.RESEND_API_KEY;
    const quote = await requestVetQuote({
      householdId,
      userId,
      petId,
      insurancePolicyId: policyId,
      vetClinicId: clinicId,
      procedureSummary: "ZZTEST: TPLO surgery for bilateral cruciate injury",
    });
    assert(quote.ok === true, "requestVetQuote returns ok with grant present", JSON.stringify(quote));
    if (quote.ok) {
      const { data: oe } = await svc.from("outbound_emails").select("*").eq("id", quote.outbound_email_id).single();
      assert(oe?.status === "drafted", "vet-quote outbound row recorded 'drafted' (no-key)", `status=${oe?.status}`);
      assert(!!oe?.authorization_id, "vet-quote outbound carries authorization_id FK");
      assert(oe?.recipient_email === "zztest-vet@example.com", "vet-quote recipient is the clinic email");
      assert(oe?.recipient_type === "vet_clinic", "recipient_type = vet_clinic");
      assert(typeof oe?.body_html === "string" && (oe.body_html as string).includes("ZZTEST"), "vet-quote body_html includes the procedure summary (escaped)");
      const { data: ce } = await svc.from("cost_estimates").select("*").eq("id", quote.cost_estimate_id).single();
      assert(ce?.status === "pending_vet_response", "cost_estimate created in pending_vet_response");
      assert(ce?.request_email_id === quote.outbound_email_id, "cost_estimate links back to the request email");
    }

    // -------------------------------------------------------------------
    section("4c. requestVetQuote - clinic with no email fails cleanly");
    // -------------------------------------------------------------------
    const quoteNoEmail = await requestVetQuote({
      householdId,
      userId,
      petId,
      insurancePolicyId: policyId,
      vetClinicId: clinicNoEmailId,
      procedureSummary: "ZZTEST: dental cleaning",
    });
    assert(!quoteNoEmail.ok && quoteNoEmail.code === "no_clinic_email", "requestVetQuote refuses a clinic with no email on file", JSON.stringify(quoteNoEmail));

    // -------------------------------------------------------------------
    section("4d. requestVetQuote - send HTTP layer via scoped fetch stub");
    // -------------------------------------------------------------------
    {
      process.env.RESEND_API_KEY = "re_zztest_fake_key";
      const captured: { url: string; body: unknown }[] = [];
      const realFetch = globalThis.fetch;
      globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
        const u = typeof input === "string" ? input : (input as Request).url ?? String(input);
        if (u.includes("api.resend.com")) {
          let parsed: unknown = null;
          try { parsed = init?.body ? JSON.parse(init.body as string) : null; } catch { parsed = init?.body; }
          captured.push({ url: u, body: parsed });
          return new Response(JSON.stringify({ id: "zztest-vet-msgid" }), { status: 200, headers: { "content-type": "application/json" } });
        }
        return realFetch(input as string, init);
      }) as typeof fetch;
      try {
        const sent = await requestVetQuote({
          householdId,
          userId,
          petId,
          insurancePolicyId: policyId,
          vetClinicId: clinicId,
          procedureSummary: "ZZTEST: MRI for suspected disc herniation",
        });
        assert(sent.ok === true, "vet-quote send returns ok when the stubbed Resend call succeeds", JSON.stringify(sent));
        assert(captured.length === 1, "exactly one HTTP call hit api.resend.com for the vet quote", `count=${captured.length}`);
        if (captured.length) {
          const b = captured[0].body as Record<string, unknown>;
          assert(b?.subject != null && String(b.subject).includes("ZZTEST Insurance Pet"), "vet-quote payload subject names the pet");
          assert(typeof b?.html === "string" && typeof b?.text === "string", "vet-quote payload carries both html and text parts");
          assert(typeof b?.from === "string" && (b.from as string).endsWith("@pawdex.app"), "vet-quote from-address falls back to a @pawdex.app sender, not the Resend sandbox", `from=${String(b?.from)}`);
        }
      } finally {
        globalThis.fetch = realFetch;
        delete process.env.RESEND_API_KEY;
      }
    }

    // -------------------------------------------------------------------
    section("1. Policy upload -> extraction (PEC prefilter -> Sonnet -> audit)");
    // -------------------------------------------------------------------
    const pdfBytes = await buildSyntheticPolicyPdf();

    // Pre-pass sanity: text layer readable + PEC spans tagged (pre-LLM, deterministic).
    const sample = await extractTextSample(pdfBytes, "application/pdf");
    assert(sample !== null && sample.charCount > 100, "extractTextSample reads a text layer from the synthetic PDF", `sample=${sample ? sample.charCount + " chars" : "null"}`);
    const preSpans = sample ? tagPecSpans(sample.text) : [];
    assert(preSpans.length > 0, "tagPecSpans finds PEC signal spans in the policy text", `spans=${preSpans.length}`);
    assert(preSpans.some((s) => s.category_hint === "curable-with-waiting"), "prefilter catches the curable-with-waiting clause (the false-positive guard)");

    // Upload + document row + placeholder policy, then run the real pipeline.
    const docId = randomUUID();
    const storagePath = `${householdId}/insurance/${docId}.pdf`;
    const { error: upErr } = await svc.storage
      .from("documents")
      .upload(storagePath, Buffer.from(pdfBytes), { contentType: "application/pdf", upsert: false });
    if (upErr) throw new Error(`storage upload failed: ${upErr.message}`);
    created.storagePaths.push(storagePath);

    await svc.from("documents").insert({
      id: docId,
      household_id: householdId,
      pet_id: petId,
      storage_bucket: "documents",
      storage_path: storagePath,
      mime_type: "application/pdf",
      original_filename: "zztest-policy.pdf",
      byte_size: pdfBytes.byteLength,
      content_hash: `zztest-${docId}`,
      processing_status: "pending",
      created_by: userId,
    });

    const { data: extractPolicyRow } = await svc
      .from("insurance_policies")
      .insert({
        household_id: householdId,
        pet_id: petId,
        insurer_name: "Pending extraction…",
        document_id: docId,
        created_by: userId,
      })
      .select("id")
      .single();
    const extractPolicyId = extractPolicyRow!.id;

    await processPolicyExtraction({ documentId: docId, insurancePolicyId: extractPolicyId, petId });

    const { data: doc2 } = await svc.from("documents").select("processing_status, error_message").eq("id", docId).single();
    assert(doc2?.processing_status === "confirmed", "document marked 'confirmed' after extraction", `status=${doc2?.processing_status} err=${doc2?.error_message ?? ""}`);

    const { data: pol2 } = await svc.from("insurance_policies").select("*").eq("id", extractPolicyId).single();
    console.log(`  extracted: insurer=${pol2?.insurer_name} deductible_cents=${pol2?.deductible_annual_cents} rate=${pol2?.reimbursement_rate} annual_max=${pol2?.annual_max_cents}`);
    assert(pol2?.insurer_name != null && pol2.insurer_name !== "Pending extraction…", "insurer_name replaced the placeholder");
    assert(pol2?.reimbursement_rate !== null && Number(pol2?.reimbursement_rate) > 0.5 && Number(pol2?.reimbursement_rate) <= 1, "reimbursement_rate extracted in (0.5, 1]", `got ${pol2?.reimbursement_rate}`);
    assert((pol2?.deductible_annual_cents ?? 0) > 0, "deductible extracted as a positive cents value", `got ${pol2?.deductible_annual_cents}`);
    assert(Array.isArray(pol2?.extracted_exclusions) && (pol2!.extracted_exclusions as string[]).length > 0, "exclusions extracted");
    // Finding F2: the schema/prompt capture deductible_type + reimbursement_basis
    // (+ pec_clauses + waiting_period_*), but insurance_policies has no columns
    // for them and processPolicyExtraction never writes raw_extraction, so they
    // are computed by the LLM and dropped. Demonstrate the drop.
    const polAny = pol2 as Record<string, unknown> | null;
    assert(polAny != null && !("deductible_type" in polAny) && !("reimbursement_basis" in polAny), "F2: deductible_type / reimbursement_basis are NOT persisted (no columns; dropped after extraction)");
    assert(polAny != null && polAny.raw_extraction == null, "F2: raw_extraction is not stored either, so the dropped structured fields aren't recoverable");

    const { data: auditRows } = await svc
      .from("audit_log")
      .select("action, diff")
      .eq("household_id", householdId)
      .eq("entity_id", extractPolicyId)
      .eq("action", "commit_extraction");
    const auditRow = (auditRows ?? [])[0] as { diff?: { after?: { pec_prefilter?: unknown } } } | undefined;
    const pecMeta = auditRow?.diff?.after?.pec_prefilter as { span_count?: number; categories?: string[]; char_count?: number } | null | undefined;
    console.log(`  audit pec_prefilter: ${JSON.stringify(pecMeta)}`);
    assert(!!auditRow, "commit_extraction audit row written for the policy");
    assert(!!pecMeta && typeof pecMeta.span_count === "number" && pecMeta.span_count > 0, "audit row carries pec_prefilter metadata with span_count > 0", JSON.stringify(pecMeta));
    assert(!!pecMeta && Array.isArray(pecMeta.categories) && pecMeta.categories.includes("curable-with-waiting"), "pec_prefilter metadata records the curable-with-waiting category");

    // -------------------------------------------------------------------
    section("5. Claims - CRUD, status transitions, attachments, guard");
    // -------------------------------------------------------------------
    // Guard: a household-scoped policy (no pet) has no valid pet for a claim.
    // The action rejects this; at the DB level claims.pet_id is NOT NULL so an
    // insert without a pet is impossible. Assert the schema-level guarantee.
    const { error: noPetErr } = await svc
      .from("claims")
      .insert({ household_id: householdId, insurance_policy_id: hhPolicyId, status: "drafted", created_by: userId } as never)
      .select("id")
      .single();
    assert(!!noPetErr, "claims insert without pet_id is rejected by NOT NULL (mirrors the household-policy guard)", noPetErr?.message);

    const { data: claim } = await svc
      .from("claims")
      .insert({
        household_id: householdId,
        pet_id: petId,
        insurance_policy_id: policyId,
        status: "drafted",
        service_date: "2026-03-01",
        total_billed_cents: 48750,
        created_by: userId,
      })
      .select("id")
      .single();
    const claimId = claim!.id;
    assert(!!claimId, "claim created in 'drafted'");

    // Status transitions drafted -> submitted -> partially_approved with amounts.
    await svc.from("claims").update({ status: "submitted", submitted_on: "2026-03-02" }).eq("id", claimId).eq("household_id", householdId);
    await svc.from("claims").update({ status: "partially_approved", decided_on: "2026-03-20", amount_approved_cents: 30000, amount_reimbursed_cents: 24000, denial_reason: "Partial: bilateral hip flagged pre-existing" }).eq("id", claimId).eq("household_id", householdId);
    const { data: claim2 } = await svc.from("claims").select("*").eq("id", claimId).single();
    assert(claim2?.status === "partially_approved", "claim reached partially_approved");
    assert(claim2?.amount_reimbursed_cents === 24000, "reimbursed amount persisted");

    // Attachment linking (link a medical_event + a document).
    const { error: attErr1 } = await svc.from("claim_attachments").insert({ claim_id: claimId, household_id: householdId, attachment_type: "document", attachment_id: docId });
    assert(!attErr1, "claim_attachments accepts a document link", attErr1?.message);
    const { data: atts } = await svc.from("claim_attachments").select("*").eq("claim_id", claimId);
    assert((atts ?? []).length === 1, "attachment row is readable back", `count=${atts?.length}`);
    // Bad attachment_type rejected by the CHECK constraint.
    const { error: attErr2 } = await svc.from("claim_attachments").insert({ claim_id: claimId, household_id: householdId, attachment_type: "bogus", attachment_id: docId } as never);
    assert(!!attErr2, "claim_attachments rejects an invalid attachment_type (CHECK)", attErr2?.message);

    // Delete.
    await svc.from("claims").delete().eq("id", claimId).eq("household_id", householdId);
    const { data: gone } = await svc.from("claims").select("id").eq("id", claimId).maybeSingle();
    assert(gone === null, "claim delete removes the row (and cascades attachments)");
    const { data: attsGone } = await svc.from("claim_attachments").select("*").eq("claim_id", claimId);
    assert((attsGone ?? []).length === 0, "claim_attachments cascade-deleted with the claim");

    // -------------------------------------------------------------------
    section("6a. PEC heuristic matcher (analyzePECForHousehold, deterministic)");
    // -------------------------------------------------------------------
    // Runs through the RLS server client, which the shim points at our service
    // client, so it exercises the real token-overlap heuristic against the
    // seeded 'Hip dysplasia diagnosis (bilateral)' event and the policy's
    // 'hip dysplasia' exclusion (overlap {hip, dysplasia} = 2 = MIN_OVERLAP).
    const analyses = await analyzePECForHousehold(householdId);
    const seededPolicyAnalysis = analyses.find((a) => a.policy_id === policyId);
    console.log(`  analyses for ${analyses.length} policies; seeded policy flagged=${seededPolicyAnalysis?.flagged.length ?? 0}`);
    assert(!!seededPolicyAnalysis, "analyzePECForHousehold returns an analysis for the seeded policy");
    const hipFlag = seededPolicyAnalysis?.flagged.find((f) => /hip dysplasia/i.test(f.title));
    assert(!!hipFlag, "the hip dysplasia medical event is flagged by the heuristic");
    assert(!!hipFlag?.matches.some((m) => /hip dysplasia/i.test(m.exclusion) && m.overlap_count >= 2), "flag matches the hip-dysplasia exclusion with >=2 token overlap", JSON.stringify(hipFlag?.matches?.[0]));

    // -------------------------------------------------------------------
    section("6. PEC Tier-2 refinement (refinePECAnalysis, real LLM)");
    // -------------------------------------------------------------------
    const verdicts = await refinePECAnalysis({
      policy_id: policyId,
      insurer_name: "ZZTest Assurance Company",
      exclusions_count: 3,
      flagged: [
        {
          event_id: "zztest-evt-1",
          event_type: "illness",
          occurred_on: "2026-02-10",
          title: "Hip dysplasia diagnosis (bilateral)",
          diagnosis: "Bilateral hip dysplasia confirmed on radiographs",
          matches: [
            { exclusion: "Hereditary or congenital conditions including hip dysplasia", exclusion_tokens: ["hereditary", "congenital", "hip", "dysplasia"], overlap: ["hip", "dysplasia"], overlap_count: 2 },
          ],
        },
        {
          event_id: "zztest-evt-2",
          event_type: "exam",
          occurred_on: "2026-04-01",
          title: "Ear cropping post-op recheck",
          diagnosis: null,
          matches: [
            { exclusion: "Dental cleanings and preventive dental care", exclusion_tokens: ["dental", "cleanings", "preventive", "care"], overlap: ["dental", "care"], overlap_count: 2 },
          ],
        },
      ],
    });
    console.log(`  verdicts: ${JSON.stringify(verdicts)}`);
    assert(Array.isArray(verdicts) && verdicts.length === 2, "refinePECAnalysis returns one verdict per flagged event", `count=${verdicts.length}`);
    assert(verdicts.every((v) => ["match", "ambiguous", "false_positive"].includes(v.verdict) && typeof v.rationale === "string"), "each verdict has a valid verdict enum + rationale");
    const hipVerdict = verdicts.find((v) => v.event_id === "zztest-evt-1");
    assert(hipVerdict?.verdict === "match" || hipVerdict?.verdict === "ambiguous", "hip dysplasia event is treated as a real/ambiguous match, not a false positive", JSON.stringify(hipVerdict));

    // -------------------------------------------------------------------
    section("7. RLS - anon client cannot read insurance tables");
    // -------------------------------------------------------------------
    const anon = createClient(url, anonKey);
    for (const table of ["insurance_policies", "cost_estimates", "claims", "claim_attachments"]) {
      const { data, error } = await anon.from(table).select("*").eq("household_id", householdId).limit(5);
      const rows = data?.length ?? 0;
      assert(rows === 0, `anon read of ${table} for our household returns zero rows (fail-closed)`, `rows=${rows} err=${error?.message ?? "none"}`);
    }

    // -------------------------------------------------------------------
    section("8. Manual policy management - create / archive / list");
    // -------------------------------------------------------------------
    // createInsurancePolicy / archiveInsurancePolicy are requireSession +
    // FormData wrappers; their DB contract is exercised here directly (the
    // wrappers themselves are inspection-verified). asPercent stores the rate
    // as a 0..1 decimal - mirror that.
    const { data: manualPolicy } = await svc
      .from("insurance_policies")
      .insert({
        household_id: householdId,
        pet_id: petId,
        insurer_name: "ZZTest Manual Insurer",
        plan_name: "Manual Plan",
        reimbursement_rate: 0.9, // asPercent(90) => 0.9
        deductible_annual_cents: 15000,
        extracted_exclusions: ["Manual exclusion line one", "Manual exclusion line two"],
        created_by: userId,
      })
      .select("id")
      .single();
    const manualPolicyId = manualPolicy!.id;
    assert(!!manualPolicyId, "manual policy created via the create-policy DB contract");

    const activeBefore = await listInsurancePolicies(householdId);
    assert(activeBefore.some((p) => p.id === manualPolicyId), "listInsurancePolicies includes the active manual policy (and joins pet_name)");
    assert(activeBefore.find((p) => p.id === manualPolicyId)?.pet_name === "ZZTEST Insurance Pet", "list joins the pet name onto the policy");

    // Archive (soft delete) and confirm it drops out of the active list.
    await svc.from("insurance_policies").update({ archived_at: new Date().toISOString() }).eq("id", manualPolicyId).eq("household_id", householdId);
    const activeAfter = await listInsurancePolicies(householdId);
    assert(!activeAfter.some((p) => p.id === manualPolicyId), "archiveInsurancePolicy hides the policy from the active list (archived_at filter)");
    const { data: stillThere } = await svc.from("insurance_policies").select("id, archived_at").eq("id", manualPolicyId).single();
    assert(stillThere?.archived_at != null, "archive is a soft delete - the row persists with archived_at set (no hard delete action exists)");

  } finally {
    // -------------------------------------------------------------------
    section("Cleanup");
    // -------------------------------------------------------------------
    if (created.storagePaths.length) {
      const { error } = await svc.storage.from("documents").remove(created.storagePaths);
      console.log(`  removed ${created.storagePaths.length} storage object(s)${error ? ` (err: ${error.message})` : ""}`);
    }
    if (created.householdId) {
      // households cascade-delete pets, policies, claims, cost_estimates,
      // outbound_emails, authorizations, medical_events, documents,
      // claim_attachments, audit_log and memberships.
      const { error } = await svc.from("households").delete().eq("id", created.householdId);
      console.log(`  deleted household ${created.householdId}${error ? ` (err: ${error.message})` : " (cascaded)"}`);
    }
    if (created.userId) {
      const { error } = await svc.auth.admin.deleteUser(created.userId);
      console.log(`  deleted auth user ${created.userId}${error ? ` (err: ${error.message})` : ""}`);
    }
  }

  console.log("\n" + "=".repeat(72));
  const passed = results.filter((r) => r.pass).length;
  console.log(`SUMMARY: ${passed}/${results.length} assertions passed`);
  if (failed) {
    console.log("RESULT: FAIL");
    process.exitCode = 1;
  } else {
    console.log("RESULT: PASS");
  }
}

main().catch((err) => {
  console.error("\nFATAL:", err);
  process.exit(1);
});
