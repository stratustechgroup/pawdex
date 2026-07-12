"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import { getNextPendingReviewDocument } from "@/lib/db/documents";
import { getLatestExtraction, extractResultFromEnvelope } from "@/lib/db/extractions";
import {
  computeValueDiff,
  type CommittedDraft,
  type ValueDiff,
} from "@/lib/ai/value-diff";
import { indexExtractionForQa } from "@/lib/ai/extraction-indexer";
import {
  computeExpiryFromFamily,
  inferFamilyFromType,
} from "@/lib/clinical/vaccine-catalog";
import { estimateCourseEnd } from "@/lib/clinical/course-duration";
import { recordAudit } from "@/lib/db/audit";
import { maybeScheduleRecordsRequest } from "@/lib/outbound/records-request-schedule";
import { normalizePhone } from "@/lib/utils/phone";
import type {
  Json,
  ExtractionFeedbackRating,
  MedicationContext,
} from "@/lib/supabase/types";

type FeedbackPayload = {
  rating: ExtractionFeedbackRating;
  issue_tags: string[];
  issue_notes: string | null;
};

/**
 * Did the user actually touch the extraction before committing? True when any
 * row was edited or skipped, or the vet clinic was changed. Drives whether we
 * write an implicit feedback row. An untouched commit produces no signal, so
 * we stay silent rather than fabricating a "mostly_good" rating.
 */
function diffHasCorrections(diff: ValueDiff): boolean {
  if (diff.vet_clinic_changed) return true;
  for (const group of [
    diff.vaccinations,
    diff.medications,
    diff.medical_events,
    diff.weights,
  ]) {
    for (const row of group) {
      if (row.skipped || row.changes.length > 0) return true;
    }
  }
  return false;
}

type CommitInput = {
  petId: string;
  documentId: string;
  extractionId: string;
  vetClinic: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  } | null;
  /** Owner contact extracted from the same document. Used purely to detect
   *  when the model attributed the owner's phone/email to the vet clinic. */
  ownerContact: {
    phone: string | null;
    email: string | null;
    address: string | null;
  } | null;
  vaccinations: CommittedDraft["vaccinations"];
  medications: CommittedDraft["medications"];
  medical_events: CommittedDraft["medical_events"];
  weights: CommittedDraft["weights"];
  /** Per-analyte lab values from structured panel tables (prompt v6+). */
  lab_values?: Array<{
    skip?: boolean;
    analyte: string;
    value: number | null;
    units: string | null;
    reference_low: number | null;
    reference_high: number | null;
    flag: string | null;
    collected_on: string;
    lab: string | null;
  }>;
  /** Cost line items from an invoice / itemized visit summary (prompt v7.1+).
   *  amount is in DOLLARS as the user reviewed it; converted to cents here. */
  invoice_items?: Array<{
    skip?: boolean;
    description: string;
    amount: number;
    category: "exam" | "vaccine" | "medication" | "procedure" | "lab" | "other";
    incurred_on: string | null;
  }>;
  /** Forward-looking due dates extracted from the document (prompt v6+). */
  upcoming_reminders?: Array<{
    skip?: boolean;
    title: string;
    due_on: string;
    entity_type: "vaccine" | "exam" | "lab" | "preventative" | "other";
  }>;
  /** Pet attribute fields the user accepted from the doc's claim (prompt v6+). */
  pet_attribute_updates?: Partial<{
    breed: string | null;
    sex: "male" | "female" | "unknown";
    altered: boolean | null;
    date_of_birth: string | null;
    microchip_number: string | null;
    microchip_registry: string | null;
    microchip_implanted_on: string | null;
    color: string | null;
  }>;
  feedback: FeedbackPayload | null;
};

export type CommitResult =
  | {
      ok: true;
      counts: {
        vaccinations: number;
        medications: number;
        events: number;
        weights: number;
        lab_values: number;
        upcoming_reminders: number;
      };
    }
  | { ok: false; error: string };

export async function commitExtraction(input: CommitInput): Promise<CommitResult> {
  const session = await requireSession();
  const supabase = await createClient();

  // Resolve vet clinic. Dedupe in priority order:
  //   1. By normalized phone (strongest — phones don't collide across clinics)
  //   2. By lowercased name (fallback for clinics without a phone yet)
  // Before storing, drop any vet phone / email / address that matches the
  // owner's contact info — that's an extraction misattribution, not a real
  // vet contact. We'd rather store NULL than wrong data.
  let vetClinicId: string | null = null;
  if (input.vetClinic && input.vetClinic.name.trim()) {
    const name = input.vetClinic.name.trim();

    const ownerPhone = normalizePhone(input.ownerContact?.phone ?? null);
    const ownerEmail = input.ownerContact?.email?.trim().toLowerCase() ?? null;
    const ownerAddress = input.ownerContact?.address?.trim() ?? null;

    const rawVetPhone = input.vetClinic.phone;
    const normalizedVetPhone = normalizePhone(rawVetPhone);
    const vetEmail = input.vetClinic.email?.trim() ?? null;
    const vetAddress = input.vetClinic.address?.trim() ?? null;

    // Strike through fields that match the owner's contact — these are the
    // extraction-confusion cases.
    const cleanPhone =
      normalizedVetPhone && ownerPhone && normalizedVetPhone === ownerPhone
        ? null
        : rawVetPhone;
    const cleanEmail =
      vetEmail && ownerEmail && vetEmail.toLowerCase() === ownerEmail
        ? null
        : vetEmail;
    const cleanAddress =
      vetAddress && ownerAddress && vetAddress === ownerAddress ? null : vetAddress;

    const cleanedNormalizedPhone = normalizePhone(cleanPhone);

    // 1. Try phone-based match first.
    let existing:
      | {
          id: string;
          phone: string | null;
          email: string | null;
          address_line1: string | null;
          name: string;
        }
      | null = null;

    if (cleanedNormalizedPhone) {
      const { data } = await supabase
        .from("vet_clinics")
        .select("id, phone, email, address_line1, name")
        .eq("household_id", session.householdId)
        .eq("phone_normalized", cleanedNormalizedPhone)
        .limit(1)
        .maybeSingle();
      if (data) existing = data;
    }

    // 2. Fall back to name match.
    if (!existing) {
      const { data } = await supabase
        .from("vet_clinics")
        .select("id, phone, email, address_line1, name")
        .eq("household_id", session.householdId)
        .ilike("name", name)
        .limit(1)
        .maybeSingle();
      if (data) existing = data;
    }

    if (existing) {
      vetClinicId = existing.id;
      // Enrich missing fields. If we have a cleaner name (more specific), upgrade.
      const patch: {
        phone?: string | null;
        email?: string | null;
        address_line1?: string | null;
        name?: string;
      } = {};
      if (!existing.phone && cleanPhone) patch.phone = cleanPhone;
      if (!existing.email && cleanEmail) patch.email = cleanEmail;
      if (!existing.address_line1 && cleanAddress)
        patch.address_line1 = cleanAddress;
      if (name.length > existing.name.length) patch.name = name;
      if (Object.keys(patch).length > 0) {
        await supabase
          .from("vet_clinics")
          .update(patch)
          .eq("household_id", session.householdId)
          .eq("id", existing.id);
      }
    } else {
      const { data: created, error: createErr } = await supabase
        .from("vet_clinics")
        .insert({
          household_id: session.householdId,
          name,
          phone: cleanPhone,
          email: cleanEmail,
          address_line1: cleanAddress,
        })
        .select("id")
        .single();
      if (createErr || !created) {
        return { ok: false, error: `Vet clinic insert failed: ${createErr?.message}` };
      }
      vetClinicId = created.id;
    }
  }

  // Pet DOB drives the "first-dose-is-1-year" rule in the vaccine-catalog
  // expiry calculator. Loaded once before mapping the rows.
  const { data: petRow } = await supabase
    .from("pets")
    .select("date_of_birth")
    .eq("household_id", session.householdId)
    .eq("id", input.petId)
    .maybeSingle();
  const petDob = petRow?.date_of_birth ?? null;

  const vaccRows = input.vaccinations
    .filter((v) => !v.skip && v.vaccine_type.trim() && v.administered_on)
    .map((v) => {
      // Infer locally so we can fall back on the catalog default for expiry
      // when the extractor didn't populate one. We do NOT persist this:
      // `vaccine_family` is a GENERATED ALWAYS column in Postgres, derived
      // server-side from `vaccine_type`. Writes to it are rejected.
      const family = inferFamilyFromType(v.vaccine_type);
      // Fallback: if the extractor didn't populate expires_on, compute it
      // from the vaccine-catalog default for this family. Honors the
      // first-dose-is-1-year rule when pet DOB is known.
      let expires = v.expires_on;
      if (!expires) {
        const computed = computeExpiryFromFamily({
          family,
          administered_on: v.administered_on,
          pet_date_of_birth: petDob,
        });
        if (computed) expires = computed.expires_on;
      }
      return {
        household_id: session.householdId,
        pet_id: input.petId,
        vaccine_type: v.vaccine_type.trim(),
        administered_on: v.administered_on,
        expires_on: expires,
        lot_number: v.lot_number,
        manufacturer: v.manufacturer,
        administering_vet: v.administering_vet,
        vet_clinic_id: vetClinicId,
        document_id: input.documentId,
        created_by: session.userId,
      };
    });

  const medRows = input.medications
    .filter((m) => !m.skip && m.name.trim() && m.dose.trim() && m.started_on)
    .map((m) => {
      // ended_on + ended_estimated. An end is "estimated" whenever it derives
      // from a COURSE LENGTH (a duration or a dispensed count), never from a
      // vet-stated stop date:
      //   - end present AND a course length present → the model computed the end
      //     from "x 7 days" / "#14 BID"; still an estimate.
      //   - no end but a course length → we compute it here; estimate.
      //   - end present with NO course length → an explicit stop date; NOT
      //     estimated (the vet wrote "discontinue on ...").
      // Estimated ends drive the "course likely finished (est.)" label + the
      // "still taking it" override; we never expire a med without that marker.
      const hasCourseLength =
        (m.duration_days != null && m.duration_days > 0) ||
        (m.total_doses != null && m.total_doses > 0);
      let endedOn = m.ended_on;
      let endedEstimated = false;
      if (!endedOn) {
        const estimate = estimateCourseEnd({
          started_on: m.started_on,
          duration_days: m.duration_days,
          total_doses: m.total_doses ?? null,
          frequency: m.frequency,
        });
        if (estimate) {
          endedOn = estimate.ended_on;
          endedEstimated = true;
        }
      } else if (hasCourseLength) {
        endedEstimated = true;
      }
      return {
        household_id: session.householdId,
        pet_id: input.petId,
        name: m.name.trim(),
        dose: m.dose.trim(),
        frequency: m.frequency,
        started_on: m.started_on,
        ended_on: endedOn,
        ended_estimated: endedEstimated,
        duration_days: m.duration_days,
        medication_context: m.medication_context as MedicationContext,
        prescriber: m.prescriber,
        indication: m.indication,
        vet_clinic_id: vetClinicId,
        document_id: input.documentId,
        created_by: session.userId,
      };
    });

  const eventRows = input.medical_events
    .filter((e) => !e.skip && e.title.trim() && e.occurred_on)
    .map((e) => ({
      household_id: session.householdId,
      pet_id: input.petId,
      event_type: e.event_type,
      occurred_on: e.occurred_on,
      title: e.title.trim(),
      summary: e.summary,
      diagnosis: e.diagnosis,
      treatment: e.treatment,
      attending_vet: e.attending_vet,
      vet_clinic_id: vetClinicId,
      document_id: input.documentId,
      created_by: session.userId,
    }));

  const weightRows = input.weights
    .filter((w) => !w.skip && Number.isFinite(w.weight_kg) && w.weight_kg > 0 && w.recorded_on)
    .map((w) => ({
      household_id: session.householdId,
      pet_id: input.petId,
      recorded_on: w.recorded_on,
      weight_kg: w.weight_kg,
      source: "extracted" as const,
      document_id: input.documentId,
      created_by: session.userId,
    }));

  const [vaccResult, medResult, eventResult, weightResult] = await Promise.all([
    vaccRows.length
      ? supabase.from("vaccinations").insert(vaccRows)
      : Promise.resolve({ error: null as null | { message: string } }),
    medRows.length
      ? supabase.from("medications").insert(medRows)
      : Promise.resolve({ error: null as null | { message: string } }),
    eventRows.length
      ? supabase.from("medical_events").insert(eventRows).select("id")
      : Promise.resolve({
          error: null as null | { message: string },
          data: [] as { id: string }[],
        }),
    weightRows.length
      ? supabase.from("weight_log").insert(weightRows)
      : Promise.resolve({ error: null as null | { message: string } }),
  ]);

  for (const r of [vaccResult, medResult, eventResult, weightResult]) {
    if (r.error) return { ok: false, error: r.error.message };
  }

  // Fire the auto-schedule hook for each new medical_event. Safe to fail —
  // any error here shouldn't block the commit, and the user can always send
  // manually from the medical history page.
  const insertedEventIds = ("data" in eventResult ? eventResult.data ?? [] : [])
    .map((row) => row.id);
  if (insertedEventIds.length > 0) {
    after(async () => {
      for (const id of insertedEventIds) {
        try {
          await maybeScheduleRecordsRequest({
            householdId: session.householdId,
            medicalEventId: id,
            createdBy: session.userId,
          });
        } catch (err) {
          console.error("maybeScheduleRecordsRequest failed", { id, err });
        }
      }
    });
  }

  // Index the committed extraction for doc Q&A. Best-effort.
  const extractionForIndex = await supabase
    .from("document_extractions")
    .select("raw_response")
    .eq("household_id", session.householdId)
    .eq("id", input.extractionId)
    .maybeSingle();
  if (extractionForIndex.data?.raw_response) {
    after(async () => {
      try {
        await indexExtractionForQa({
          householdId: session.householdId,
          documentId: input.documentId,
          extractionId: input.extractionId,
          petId: input.petId,
          rawResponse: extractionForIndex.data!.raw_response,
        });
      } catch (err) {
        console.error("indexExtractionForQa failed", { err });
      }
    });
  }

  if (weightRows.length > 0) {
    const newestWeight = weightRows.reduce((acc, w) =>
      w.recorded_on > acc.recorded_on ? w : acc,
    );
    await supabase
      .from("pets")
      .update({ current_weight_kg: newestWeight.weight_kg })
      .eq("household_id", session.householdId)
      .eq("id", input.petId);
  }

  // ── Lab values (prompt v6) ────────────────────────────────────
  // Persist structured per-analyte rows when the user committed them. Skip
  // rows are dropped here at the source — they never hit the DB.
  const labRows = (input.lab_values ?? [])
    .filter(
      (l) =>
        !l.skip &&
        l.analyte.trim() &&
        l.value !== null &&
        Number.isFinite(l.value) &&
        l.collected_on,
    )
    .map((l) => {
      const computedFlag: string | null =
        l.flag ??
        (l.reference_low !== null && l.reference_high !== null && l.value !== null
          ? l.value < l.reference_low
            ? "L"
            : l.value > l.reference_high
              ? "H"
              : "normal"
          : null);
      return {
        household_id: session.householdId,
        pet_id: input.petId,
        analyte: l.analyte.trim(),
        value: l.value!,
        units: l.units,
        reference_low: l.reference_low,
        reference_high: l.reference_high,
        flag: computedFlag,
        collected_on: l.collected_on,
        lab: l.lab,
        document_id: input.documentId,
        created_by: session.userId,
      };
    });
  if (labRows.length > 0) {
    const { error } = await supabase.from("lab_values").insert(labRows);
    if (error) {
      console.error("lab_values insert failed", error.message);
    }
  }

  // ── Upcoming reminders (prompt v6) ────────────────────────────
  // Insert directly into `reminders` with status='scheduled'. The unique
  // index on (entity_type, entity_id, lead_days) keeps this idempotent —
  // re-running commit doesn't duplicate.
  const reminderRows = (input.upcoming_reminders ?? [])
    .filter((r) => !r.skip && r.title.trim() && r.due_on)
    .map((r) => ({
      household_id: session.householdId,
      pet_id: input.petId,
      entity_type: r.entity_type === "vaccine" ? "vaccination" : r.entity_type,
      // entity_id is required NOT NULL — use the document_id as a stable
      // anchor when there's no specific vaccination row tied to this reminder.
      entity_id: input.documentId,
      due_on: r.due_on,
      lead_days: 0,
      scheduled_for: r.due_on,
      status: "scheduled" as const,
    }));
  let remindersInserted = 0;
  if (reminderRows.length > 0) {
    const { data, error } = await supabase
      .from("reminders")
      .upsert(reminderRows, {
        onConflict: "entity_type,entity_id,lead_days",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) {
      console.error("upcoming_reminders insert failed", error.message);
    } else {
      remindersInserted = data?.length ?? 0;
    }
  }

  // ── Invoice cost items (prompt v7.1) ──────────────────────────
  // Persist per-line charges into invoice_items. Amounts arrive in dollars and
  // are stored as integer cents. Skip rows and non-positive amounts are dropped
  // (a $0.00 / included line carries no spending signal). medical_event_id is
  // left null in v1 — the cost<>event link is future work.
  const invoiceRows = (input.invoice_items ?? [])
    .filter(
      (c) => !c.skip && c.description.trim() && Number.isFinite(c.amount) && c.amount > 0,
    )
    .map((c) => ({
      household_id: session.householdId,
      pet_id: input.petId,
      document_id: input.documentId,
      description: c.description.trim(),
      amount_cents: Math.round(c.amount * 100),
      category: c.category,
      incurred_on: c.incurred_on,
      created_by: session.userId,
    }));
  if (invoiceRows.length > 0) {
    const { error } = await supabase.from("invoice_items").insert(invoiceRows);
    if (error) {
      console.error("invoice_items insert failed", error.message);
    }
  }

  // ── Pet attribute updates (prompt v6) ─────────────────────────
  // The review UI offered diffs and the user accepted some — apply them.
  if (
    input.pet_attribute_updates &&
    Object.keys(input.pet_attribute_updates).length > 0
  ) {
    const { error } = await supabase
      .from("pets")
      .update(input.pet_attribute_updates)
      .eq("household_id", session.householdId)
      .eq("id", input.petId);
    if (error) {
      console.error("pet_attribute_updates failed", error.message);
    } else {
      await recordAudit({
        householdId: session.householdId,
        actorId: session.userId,
        action: "update",
        entityType: "pet",
        entityId: input.petId,
        diff: {
          after: input.pet_attribute_updates as unknown as Json,
          source: "document_extraction_reconciliation",
        },
      });
    }
  }

  // Persist explicit + implicit feedback before flipping the extraction status.
  // Implicit = value-diff between what the model said and what the user committed.
  const extractionRow = await supabase
    .from("document_extractions")
    .select("model, prompt_version, raw_response")
    .eq("household_id", session.householdId)
    .eq("id", input.extractionId)
    .maybeSingle();

  if (extractionRow.data) {
    const rawExtraction = extractResultFromEnvelope(extractionRow.data.raw_response);
    let valueDiff: Json = {};
    let userMadeCorrections = false;
    if (rawExtraction) {
      const diff = computeValueDiff(rawExtraction, {
        vaccinations: input.vaccinations,
        medications: input.medications,
        medical_events: input.medical_events,
        weights: input.weights,
        vetClinic: input.vetClinic,
      });
      valueDiff = diff as unknown as Json;
      userMadeCorrections = diffHasCorrections(diff);
    }

    if (input.feedback) {
      await supabase.from("extraction_feedback").insert({
        household_id: session.householdId,
        document_id: input.documentId,
        extraction_id: input.extractionId,
        rating: input.feedback.rating,
        issue_tags: input.feedback.issue_tags,
        issue_notes: input.feedback.issue_notes,
        value_diff: valueDiff,
        extraction_model: extractionRow.data.model,
        extraction_prompt_version: extractionRow.data.prompt_version,
        created_by: session.userId,
      });
    } else if (userMadeCorrections) {
      // No explicit rating, but the user edited or skipped rows before
      // committing, record that as implicit "mostly_good" (right enough that
      // they kept it, wrong enough that they fixed it). We deliberately do NOT
      // write anything when the extraction was committed untouched: stamping a
      // rating on every commit biased the learning corpus toward "mostly_good"
      // and drowned out the real correction signal. The enum has no neutral
      // value and we can't add one without a migration, so silence is the
      // honest option for an uncorrected commit.
      await supabase.from("extraction_feedback").insert({
        household_id: session.householdId,
        document_id: input.documentId,
        extraction_id: input.extractionId,
        rating: "mostly_good",
        issue_tags: [],
        issue_notes: null,
        value_diff: valueDiff,
        extraction_model: extractionRow.data.model,
        extraction_prompt_version: extractionRow.data.prompt_version,
        created_by: session.userId,
      });
    }
  }

  await supabase
    .from("document_extractions")
    .update({
      status: "committed",
      committed_at: new Date().toISOString(),
      committed_by: session.userId,
    })
    .eq("household_id", session.householdId)
    .eq("id", input.extractionId);

  await supabase
    .from("documents")
    .update({
      processing_status: "confirmed",
      confirmed_at: new Date().toISOString(),
    })
    .eq("household_id", session.householdId)
    .eq("id", input.documentId);

  revalidatePath("/");
  revalidatePath(`/pets/${input.petId}`);
  revalidatePath(`/pets/${input.petId}/vaccines`);
  revalidatePath(`/pets/${input.petId}/medical`);
  revalidatePath(`/pets/${input.petId}/medications`);
  revalidatePath(`/pets/${input.petId}/weight`);
  revalidatePath(`/pets/${input.petId}/documents`);

  // Chain to the next pending-review document for this pet, if any.
  const next = await getNextPendingReviewDocument(
    session.householdId,
    input.petId,
    input.documentId,
  );
  if (next) {
    redirect(`/pets/${input.petId}/documents/${next.id}/review`);
  }
  redirect(`/pets/${input.petId}`);
}

type DiscardInput = {
  petId: string;
  documentId: string;
  extractionId: string;
  feedback?: FeedbackPayload | null;
};

export async function discardExtraction(input: DiscardInput): Promise<void> {
  const session = await requireSession();
  const supabase = await createClient();

  if (input.feedback) {
    // Pull the extraction row for the model/prompt fingerprint we want to log.
    const extractionRow = await supabase
      .from("document_extractions")
      .select("model, prompt_version, raw_response")
      .eq("household_id", session.householdId)
      .eq("id", input.extractionId)
      .maybeSingle();
    if (extractionRow.data) {
      await supabase.from("extraction_feedback").insert({
        household_id: session.householdId,
        document_id: input.documentId,
        extraction_id: input.extractionId,
        rating: input.feedback.rating,
        issue_tags: input.feedback.issue_tags,
        issue_notes: input.feedback.issue_notes,
        value_diff: {},
        extraction_model: extractionRow.data.model,
        extraction_prompt_version: extractionRow.data.prompt_version,
        created_by: session.userId,
      });
    }
  }

  await supabase
    .from("document_extractions")
    .update({ status: "discarded" })
    .eq("household_id", session.householdId)
    .eq("id", input.extractionId);

  await supabase
    .from("documents")
    .update({ processing_status: "pending" })
    .eq("household_id", session.householdId)
    .eq("id", input.documentId);

  revalidatePath(`/pets/${input.petId}/documents`);

  const next = await getNextPendingReviewDocument(
    session.householdId,
    input.petId,
    input.documentId,
  );
  if (next) {
    redirect(`/pets/${input.petId}/documents/${next.id}/review`);
  }
  redirect(`/pets/${input.petId}/documents`);
}
