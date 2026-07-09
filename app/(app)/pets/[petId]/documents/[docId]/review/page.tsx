import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";

import { Icon } from "@/components/brand/icon";
import { requireSession } from "@/lib/auth/household";
import {
  getDocument,
  getDocumentSignedUrl,
  countReviewQueue,
} from "@/lib/db/documents";
import {
  getLatestExtraction,
  extractResultFromEnvelope,
} from "@/lib/db/extractions";

import {
  reconcilePetAttributes,
  findCandidateDuplicateVaccines,
  findCandidateDuplicateMedicalEvents,
  findCandidateDuplicateMedications,
  findCandidateDuplicateWeights,
  findCandidateDuplicateLabValues,
} from "@/lib/db/extraction-dedup";
import { inferFamilyFromType } from "@/lib/clinical/vaccine-catalog";

import { ReviewForm } from "./review-form";
import { ProcessingPoller } from "./processing-poller";
import { RetryExtractionForm } from "./retry-form";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ petId: string; docId: string }>;
}) {
  const { petId, docId } = await params;
  const session = await requireSession();

  const doc = await getDocument(session.householdId, docId);
  if (!doc || doc.pet_id !== petId) notFound();

  const status = doc.processing_status;

  if (status === "pending" || status === "extracting") {
    return (
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "48px 24px",
          textAlign: "center",
        }}
      >
        <ProcessingPoller intervalMs={2500} />
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--pw-pending-bg)",
            color: "var(--pw-pending-fg)",
            margin: "0 auto 16px",
          }}
        >
          <Icon name="sparkles" size={22} />
        </div>
        <h1
          className="serif"
          style={{
            margin: 0,
            font: "500 22px var(--font-source-serif)",
            color: "var(--pw-text)",
          }}
        >
          Pawdex is reading {doc.original_filename ?? "your document"}…
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            font: "400 13.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          {status === "pending"
            ? "Queued for extraction."
            : "Extracting structured data. This usually takes 5–20 seconds."}
        </p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
        <div
          className="pw-card"
          style={{
            padding: 24,
            borderColor: "var(--pw-status-overdue-fg)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 8,
              color: "var(--pw-status-overdue-fg)",
            }}
          >
            <Icon name="alert" size={18} />
            <h1
              style={{
                margin: 0,
                font: "600 16px var(--font-inter)",
                color: "var(--pw-status-overdue-fg)",
              }}
            >
              Extraction failed
            </h1>
          </div>
          <p
            style={{
              margin: "8px 0 16px",
              font: "400 13px var(--font-inter)",
              color: "var(--pw-text-secondary)",
            }}
          >
            Something went wrong while reading this document. The original file
            is safe in your vault.
          </p>
          {doc.error_message && (
            <pre
              className="mono"
              style={{
                margin: "0 0 16px",
                padding: 12,
                background: "var(--pw-surface-2)",
                borderRadius: 6,
                font: "400 11.5px var(--font-jetbrains)",
                color: "var(--pw-text-muted)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {doc.error_message}
            </pre>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <Link
              href={`/pets/${petId}/documents/${docId}`}
              style={btnSecondary}
            >
              View document
            </Link>
            <RetryExtractionForm documentId={docId} petId={petId} />
          </div>
        </div>
      </div>
    );
  }

  if (status === "confirmed") {
    return (
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "48px 24px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--pw-status-up-bg)",
            color: "var(--pw-status-up-fg)",
            margin: "0 auto 16px",
          }}
        >
          <Icon name="checkCircle" size={22} />
        </div>
        <h1
          className="serif"
          style={{
            margin: 0,
            font: "500 22px var(--font-source-serif)",
            color: "var(--pw-text)",
          }}
        >
          Already confirmed
        </h1>
        <p
          style={{
            margin: "8px 0 20px",
            font: "400 13.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          This document was committed on{" "}
          {doc.confirmed_at
            ? format(new Date(doc.confirmed_at), "MMM d, yyyy")
            : "an earlier date"}
          . Visit the pet&apos;s record to see what was added.
        </p>
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "center",
          }}
        >
          <Link href={`/pets/${petId}`} style={btnSecondary}>
            View pet
          </Link>
          <Link
            href={`/pets/${petId}/documents/${docId}`}
            style={btnPrimary}
          >
            View document
          </Link>
        </div>
      </div>
    );
  }

  // status === "extracted" — show the review form.
  const extraction = await getLatestExtraction(session.householdId, docId);
  const result = extraction
    ? extractResultFromEnvelope(extraction.raw_response)
    : null;

  if (!extraction || !result) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
        <div
          className="pw-card"
          style={{ padding: 24, background: "var(--pw-pending-bg)" }}
        >
          <h1
            style={{
              margin: 0,
              font: "600 16px var(--font-inter)",
              color: "var(--pw-pending-fg)",
            }}
          >
            No extraction available
          </h1>
          <p
            style={{
              margin: "8px 0 16px",
              font: "400 13px var(--font-inter)",
              color: "var(--pw-pending-fg)",
            }}
          >
            This document was marked as extracted but has no readable
            extraction. Try re-running.
          </p>
          <RetryExtractionForm documentId={docId} petId={petId} />
        </div>
      </div>
    );
  }

  // Dedup candidates — for each extracted entity, does the pet already have a
  // row that looks like the same real-world record? Index of each candidate
  // aligns 1:1 with the draft arrays in the review form. The form uses these
  // to default-skip high-confidence matches (so the user doesn't re-ingest
  // records already on file) while keeping every row visible + overridable.
  const vaccineCandidates = result.vaccinations.map((v) => ({
    vaccine_family: inferFamilyFromType(v.vaccine_type),
    vaccine_type: v.vaccine_type ?? "",
    administered_on: asDateString(v.administered_on),
  }));
  const eventCandidates = result.medical_events.map((e) => ({
    occurred_on: asDateString(e.occurred_on),
    title: e.title ?? "",
    event_type: e.event_type,
  }));
  const medCandidates = result.medications.map((m) => ({
    name: m.name ?? "",
    generic_name: m.generic_name ?? null,
    started_on: m.started_on ? asDateString(m.started_on) : null,
  }));
  // Mirror the form's draft init: kg preferred, lbs converted as fallback.
  const weightCandidates = result.weights.map((w) => ({
    recorded_on: asDateString(w.recorded_on),
    weight_kg:
      w.weight_kg ?? (w.weight_lbs ? w.weight_lbs / 2.20462 : null),
  }));
  const labCandidates = (result.lab_values ?? []).map((l) => ({
    analyte: l.analyte ?? "",
    collected_on: asDateString(l.collected_on),
    value: l.value,
  }));

  const [
    signedUrl,
    queueTotal,
    petAttributeDiffs,
    vaccineDupes,
    eventDupes,
    medDupes,
    weightDupes,
    labDupes,
  ] = await Promise.all([
    getDocumentSignedUrl(doc),
    countReviewQueue(session.householdId, petId),
    reconcilePetAttributes(
      session.householdId,
      petId,
      result.pet_attributes ?? null,
    ),
    findCandidateDuplicateVaccines(
      session.householdId,
      petId,
      vaccineCandidates,
    ),
    findCandidateDuplicateMedicalEvents(
      session.householdId,
      petId,
      eventCandidates,
    ),
    findCandidateDuplicateMedications(session.householdId, petId, medCandidates),
    findCandidateDuplicateWeights(session.householdId, petId, weightCandidates),
    findCandidateDuplicateLabValues(session.householdId, petId, labCandidates),
  ]);

  return (
    <ReviewForm
      petId={petId}
      documentId={docId}
      doc={{
        original_filename: doc.original_filename,
        mime_type: doc.mime_type,
      }}
      signedUrl={signedUrl}
      extractionId={extraction.id}
      extraction={result}
      extractionModel={extraction.model}
      extractionConfidence={extraction.confidence_overall}
      queueTotal={queueTotal}
      petAttributeDiffs={petAttributeDiffs.map((d) => ({
        field: d.field,
        current: d.current,
        extracted: d.extracted,
      }))}
      // Maps don't serialize across the RSC boundary — hand the client plain
      // objects keyed by candidate index.
      vaccineDupes={Object.fromEntries(vaccineDupes)}
      eventDupes={Object.fromEntries(eventDupes)}
      medDupes={Object.fromEntries(medDupes)}
      weightDupes={Object.fromEntries(weightDupes)}
      labDupes={Object.fromEntries(labDupes)}
    />
  );
}

/** Coerce an extraction date value to a plain string for the matchers. */
function asDateString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

const btnSecondary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 36,
  padding: "0 14px",
  borderRadius: 6,
  border: "1px solid var(--pw-border-strong)",
  background: "var(--pw-surface)",
  color: "var(--pw-text)",
  font: "500 13px var(--font-inter)",
  textDecoration: "none",
};

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 36,
  padding: "0 14px",
  borderRadius: 6,
  background: "var(--pw-accent)",
  color: "#fff",
  border: "1px solid var(--pw-accent)",
  font: "500 13px var(--font-inter)",
  textDecoration: "none",
  cursor: "pointer",
};
