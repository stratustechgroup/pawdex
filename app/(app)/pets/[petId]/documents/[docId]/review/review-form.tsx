"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { Icon } from "@/components/brand/icon";
import { SentOnBehalfLockup } from "@/components/pawdex/chips";
import type { ExtractionResult, SectionType } from "@/lib/ai/extraction-schema";
import type { ExtractionFeedbackRating } from "@/lib/supabase/types";
import { detectBillingLine } from "@/lib/ai/billing-line-detect";
import {
  computeExpiryFromFamily,
  inferFamilyFromType,
} from "@/lib/clinical/vaccine-catalog";

import {
  isHighConfidence,
  type VaccineMatch,
  type MedicalEventMatch,
  type MedicationMatch,
  type WeightMatch,
  type LabValueMatch,
} from "@/lib/db/extraction-dedup-match";

import { commitExtraction, discardExtraction } from "./actions";
import {
  ReviewExtensions,
  type PetAttributeDiff,
  type ReviewExtensionsState,
} from "./review-extensions";

/** True when the dedup matches for a row include at least one high-confidence
 *  (exact/strong) hit — these default the row to skip. */
function hasHighConfidenceDupe(
  matches: { match_strength: "exact" | "strong" | "loose" }[] | undefined,
): boolean {
  if (!matches || matches.length === 0) return false;
  return matches.some((m) => isHighConfidence(m.match_strength));
}

const SECTION_TYPE_LABEL: Record<SectionType, string> = {
  vaccine_block: "Vaccine block",
  visit_summary: "Visit summary",
  soap_note: "SOAP note",
  lab_panel: "Lab panel",
  imaging_report: "Imaging report",
  prescription: "Prescription",
  dental_record: "Dental record",
  surgical_report: "Surgical report",
  discharge_summary: "Discharge summary",
  invoice_section: "Invoice section",
  microchip_record: "Microchip record",
  notes: "Notes",
  header_footer: "Header / footer",
  other: "Other",
};

const ISSUE_TAGS = [
  { id: "wrong_doctype", label: "Wrong document type" },
  { id: "wrong_dates", label: "Dates wrong" },
  { id: "wrong_vaccines", label: "Vaccines wrong / missing" },
  { id: "wrong_meds", label: "Medications wrong / missing" },
  { id: "wrong_lots", label: "Lot numbers wrong" },
  { id: "missed_section", label: "Missed a section entirely" },
  { id: "ocr_failed", label: "OCR couldn't read handwriting" },
  { id: "hallucinated", label: "Made up data not in the doc" },
];

const LOW_CONFIDENCE = 0.85;

type DocMeta = {
  original_filename: string | null;
  mime_type: string | null;
};

type VaccinationDraft = {
  skip: boolean;
  vaccine_type: string;
  administered_on: string;
  expires_on: string;
  lot_number: string;
  manufacturer: string;
  administering_vet: string;
  confidence: number;
};

type MedicationContext =
  | "prescribed_takehome"
  | "intraoperative"
  | "injection_in_office"
  | "otc_recommended"
  | "unknown";

type MedicationDraft = {
  skip: boolean;
  name: string;
  dose: string;
  frequency: string;
  started_on: string;
  ended_on: string;
  duration_days: string;
  medication_context: MedicationContext;
  prescriber: string;
  indication: string;
  confidence: number;
};

const MED_CONTEXT_OPTIONS: Array<{ id: MedicationContext; label: string }> = [
  { id: "prescribed_takehome", label: "Take-home Rx" },
  { id: "intraoperative", label: "Given during surgery" },
  { id: "injection_in_office", label: "In-office injection" },
  { id: "otc_recommended", label: "OTC recommendation" },
  { id: "unknown", label: "Unknown" },
];

type MedicalEventDraft = {
  skip: boolean;
  event_type: ExtractionResult["medical_events"][number]["event_type"];
  occurred_on: string;
  title: string;
  summary: string;
  diagnosis: string;
  treatment: string;
  attending_vet: string;
  confidence: number;
};

type WeightDraft = {
  skip: boolean;
  recorded_on: string;
  weight_kg: string;
  confidence: number;
};

const EVENT_TYPES: MedicalEventDraft["event_type"][] = [
  "exam",
  "illness",
  "injury",
  "surgery",
  "dental",
  "lab_result",
  "imaging",
  "parasite_prevention",
  "behavioral",
  "other",
];

function asString(v: string | null | undefined): string {
  return v == null ? "" : v;
}

function blankIfNull(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  return t ? t : null;
}

export function ReviewForm({
  petId,
  documentId,
  doc,
  signedUrl,
  extractionId,
  extraction,
  extractionModel,
  extractionConfidence,
  queueTotal,
  petAttributeDiffs,
  vaccineDupes,
  eventDupes,
  medDupes,
  weightDupes,
  labDupes,
}: {
  petId: string;
  documentId: string;
  doc: DocMeta;
  signedUrl: string | null;
  extractionId: string;
  extraction: ExtractionResult;
  extractionModel: string;
  extractionConfidence: number | null;
  queueTotal: number;
  petAttributeDiffs: PetAttributeDiff[];
  // Dedup candidates keyed by the entity's index in the extraction arrays.
  // Present index = "this row looks like something already on file."
  vaccineDupes: Record<number, VaccineMatch[]>;
  eventDupes: Record<number, MedicalEventMatch[]>;
  medDupes: Record<number, MedicationMatch[]>;
  weightDupes: Record<number, WeightMatch[]>;
  labDupes: Record<number, LabValueMatch[]>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [vaccinations, setVaccinations] = useState<VaccinationDraft[]>(
    () =>
      extraction.vaccinations.map((v, i) => ({
        // Default-skip when confidence is low OR this dose already looks like
        // one on file (same family + same day). The row stays visible with a
        // conflict pill so the user can flip it back on.
        skip: v.confidence < 0.5 || hasHighConfidenceDupe(vaccineDupes[i]),
        vaccine_type: v.vaccine_type ?? "",
        administered_on: asString(v.administered_on),
        expires_on: asString(v.expires_on),
        lot_number: asString(v.lot_number),
        manufacturer: asString(v.manufacturer),
        administering_vet: asString(v.administering_vet),
        confidence: v.confidence,
      })),
  );

  const [medications, setMedications] = useState<MedicationDraft[]>(
    () =>
      extraction.medications.map((m, i) => {
        // Intraoperative meds default to skip — they're historical, not
        // ongoing prescriptions the owner manages. Take-home Rx default to
        // include unless the model's confidence is very low OR the same drug
        // is already on file at the same start date.
        const ctx = (m.medication_context ?? "prescribed_takehome") as MedicationContext;
        const isHistorical =
          ctx === "intraoperative" || ctx === "injection_in_office";
        const dupe = hasHighConfidenceDupe(medDupes[i]);
        return {
          skip: isHistorical || dupe ? true : m.confidence < 0.5,
          name: m.name ?? "",
          dose: m.dose ?? "",
          frequency: asString(m.frequency),
          started_on: asString(m.started_on),
          ended_on: asString(m.ended_on),
          duration_days:
            m.duration_days != null ? String(m.duration_days) : "",
          medication_context: ctx,
          prescriber: asString(m.prescriber),
          indication: asString(m.indication),
          confidence: m.confidence,
        };
      }),
  );

  const [events, setEvents] = useState<MedicalEventDraft[]>(
    () =>
      extraction.medical_events.map((e, i) => {
        // Default-skip rows that strongly look like invoice billing lines
        // (hazardous waste disposal fee, dispensing fee, etc.) OR that already
        // exist on file (same day + overlapping title tokens). Soft matches
        // and clean rows follow the confidence rule.
        const billing = detectBillingLine(e.title ?? "");
        const dupe = hasHighConfidenceDupe(eventDupes[i]);
        const skip =
          billing.kind === "strong" || dupe ? true : e.confidence < 0.5;
        return {
          skip,
          event_type: e.event_type,
          occurred_on: asString(e.occurred_on),
          title: e.title ?? "",
          summary: asString(e.summary),
          diagnosis: asString(e.diagnosis),
          treatment: asString(e.treatment),
          attending_vet: asString(e.attending_vet),
          confidence: e.confidence,
        };
      }),
  );

  const [weights, setWeights] = useState<WeightDraft[]>(
    () =>
      extraction.weights.map((w, i) => {
        const kg = w.weight_kg ?? (w.weight_lbs ? w.weight_lbs / 2.20462 : null);
        return {
          // Default-skip when the same-day reading already exists on file
          // (within 0.05 kg). Divergent same-day readings stay loose — they
          // surface a banner but are never pre-skipped.
          skip: w.confidence < 0.5 || hasHighConfidenceDupe(weightDupes[i]),
          recorded_on: asString(w.recorded_on),
          weight_kg: kg ? kg.toFixed(3) : "",
          confidence: w.confidence,
        };
      }),
  );

  const [vetClinicName, setVetClinicName] = useState(asString(extraction.vet_clinic?.name));
  const [vetClinicPhone, setVetClinicPhone] = useState(asString(extraction.vet_clinic?.phone));
  const [vetClinicEmail, setVetClinicEmail] = useState(asString(extraction.vet_clinic?.email));
  const [vetClinicAddress, setVetClinicAddress] = useState(asString(extraction.vet_clinic?.address));

  // Review-extensions state (lab values, upcoming reminders, pet attribute
  // accepts) — populated by the panels rendered above the entity cards and
  // shipped along on commit.
  const [extensionsState, setExtensionsState] = useState<ReviewExtensionsState>(
    {
      labValues: [],
      upcomingReminders: [],
      petAttributeAccepts: {},
    },
  );

  // Feedback state — captured in the widget at the bottom of the form, sent
  // along with commit/discard so the learning loop has explicit signal.
  const [feedbackRating, setFeedbackRating] = useState<ExtractionFeedbackRating | null>(
    null,
  );
  const [feedbackTags, setFeedbackTags] = useState<string[]>([]);
  const [feedbackNotes, setFeedbackNotes] = useState("");

  function buildFeedback() {
    if (!feedbackRating && feedbackTags.length === 0 && !feedbackNotes.trim()) {
      return null;
    }
    return {
      rating: feedbackRating ?? "mostly_good",
      issue_tags: feedbackTags,
      issue_notes: feedbackNotes.trim() ? feedbackNotes.trim() : null,
    };
  }

  const rabiesDetected = useMemo(
    () =>
      vaccinations.some(
        (v) => !v.skip && v.vaccine_type.toLowerCase().includes("rabies"),
      ),
    [vaccinations],
  );

  // How many rows were matched against records already on file (drives the
  // summary banner). Counted from the dupe props, not state, so it reflects
  // the original detection regardless of the user toggling rows back on.
  const dedupMatchedCount = useMemo(() => {
    let n = 0;
    for (let i = 0; i < extraction.vaccinations.length; i++)
      if (hasHighConfidenceDupe(vaccineDupes[i])) n++;
    for (let i = 0; i < extraction.medications.length; i++)
      if (hasHighConfidenceDupe(medDupes[i])) n++;
    for (let i = 0; i < extraction.medical_events.length; i++)
      if (hasHighConfidenceDupe(eventDupes[i])) n++;
    for (let i = 0; i < extraction.weights.length; i++)
      if (hasHighConfidenceDupe(weightDupes[i])) n++;
    for (let i = 0; i < (extraction.lab_values ?? []).length; i++)
      if (hasHighConfidenceDupe(labDupes[i])) n++;
    return n;
  }, [
    extraction.vaccinations.length,
    extraction.medications.length,
    extraction.medical_events.length,
    extraction.weights.length,
    extraction.lab_values,
    vaccineDupes,
    medDupes,
    eventDupes,
    weightDupes,
    labDupes,
  ]);

  const totalSelected =
    vaccinations.filter((v) => !v.skip).length +
    medications.filter((m) => !m.skip).length +
    events.filter((e) => !e.skip).length +
    weights.filter((w) => !w.skip).length;

  function handleCommit() {
    if (totalSelected === 0) {
      toast.error("Nothing to save — every section is set to Skip.");
      return;
    }
    startTransition(async () => {
      const res = await commitExtraction({
        petId,
        documentId,
        extractionId,
        feedback: buildFeedback(),
        vetClinic:
          vetClinicName.trim()
            ? {
                name: vetClinicName.trim(),
                phone: blankIfNull(vetClinicPhone),
                email: blankIfNull(vetClinicEmail),
                address: blankIfNull(vetClinicAddress),
              }
            : null,
        ownerContact: extraction.owner_contact
          ? {
              phone: extraction.owner_contact.phone ?? null,
              email: extraction.owner_contact.email ?? null,
              address: extraction.owner_contact.address ?? null,
            }
          : null,
        vaccinations: vaccinations.map((v) => ({
          skip: v.skip,
          vaccine_type: v.vaccine_type,
          administered_on: v.administered_on,
          expires_on: blankIfNull(v.expires_on),
          lot_number: blankIfNull(v.lot_number),
          manufacturer: blankIfNull(v.manufacturer),
          administering_vet: blankIfNull(v.administering_vet),
        })),
        medications: medications.map((m) => {
          const dur = m.duration_days.trim();
          const durNum = dur ? Number.parseInt(dur, 10) : NaN;
          return {
            skip: m.skip,
            name: m.name,
            dose: m.dose,
            frequency: blankIfNull(m.frequency),
            started_on: m.started_on,
            ended_on: blankIfNull(m.ended_on),
            duration_days: Number.isFinite(durNum) && durNum > 0 ? durNum : null,
            medication_context: m.medication_context,
            prescriber: blankIfNull(m.prescriber),
            indication: blankIfNull(m.indication),
          };
        }),
        medical_events: events.map((e) => ({
          skip: e.skip,
          event_type: e.event_type,
          occurred_on: e.occurred_on,
          title: e.title,
          summary: blankIfNull(e.summary),
          diagnosis: blankIfNull(e.diagnosis),
          treatment: blankIfNull(e.treatment),
          attending_vet: blankIfNull(e.attending_vet),
        })),
        weights: weights.map((w) => ({
          skip: w.skip,
          recorded_on: w.recorded_on,
          weight_kg: Number.parseFloat(w.weight_kg),
        })),
        lab_values: extensionsState.labValues.map((l) => ({
          skip: l.skip,
          analyte: l.analyte,
          value: l.value,
          units: l.units,
          reference_low: l.reference_low,
          reference_high: l.reference_high,
          flag: l.flag,
          collected_on: l.collected_on,
          lab: l.lab,
        })),
        upcoming_reminders: extensionsState.upcomingReminders.map((r) => ({
          skip: r.skip,
          title: r.title,
          due_on: r.due_on,
          entity_type: r.entity_type,
        })),
        pet_attribute_updates: extensionsState.petAttributeAccepts,
      });
      if (res && "ok" in res && !res.ok) {
        toast.error(res.error);
      }
      // Success path is a redirect from the server action; nothing else needed.
    });
  }

  function handleDiscard() {
    if (
      !window.confirm(
        "Discard this extraction? The original document stays in your vault.",
      )
    )
      return;
    startTransition(async () => {
      await discardExtraction({
        petId,
        documentId,
        extractionId,
        feedback: buildFeedback(),
      });
    });
  }

  return (
    <div
      style={{
        maxWidth: 1320,
        margin: "0 auto",
        padding: "12px 24px 88px",
      }}
    >
      {/* Slim top bar — back action on the left, file identity in the
          middle, extraction provenance on the right. Mirrors the reference
          screenshot's bar that runs full-width above the split viewer. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          paddingBottom: 12,
          marginBottom: 12,
          borderBottom: "1px solid var(--pw-border)",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            minWidth: 0,
            flex: 1,
          }}
        >
          <Link
            href={`/pets/${petId}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              height: 30,
              padding: "0 10px 0 6px",
              borderRadius: 6,
              color: "var(--pw-text-secondary)",
              font: "500 12.5px var(--font-inter)",
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            <Icon name="arrowLeft" size={13} />
            Back to pet
          </Link>
          <div
            style={{
              width: 1,
              height: 20,
              background: "var(--pw-border)",
              flexShrink: 0,
            }}
            aria-hidden
          />
          {/* File-type badge */}
          <div
            style={{
              width: 26,
              height: 32,
              borderRadius: 4,
              background: doc.mime_type === "application/pdf"
                ? "#F4D9D5"
                : doc.mime_type?.startsWith("image/")
                  ? "var(--pw-accent-soft)"
                  : "var(--pw-surface-2)",
              color: doc.mime_type === "application/pdf"
                ? "#862C28"
                : doc.mime_type?.startsWith("image/")
                  ? "var(--pw-accent-fg-on-soft)"
                  : "var(--pw-text-muted)",
              font: "700 8.5px var(--font-jetbrains)",
              letterSpacing: "0.06em",
              display: "inline-flex",
              alignItems: "flex-end",
              justifyContent: "center",
              paddingBottom: 3,
              flexShrink: 0,
            }}
          >
            {doc.mime_type === "application/pdf"
              ? "PDF"
              : doc.mime_type?.startsWith("image/")
                ? "IMG"
                : "FILE"}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                font: "600 13.5px var(--font-inter)",
                color: "var(--pw-text)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={doc.original_filename ?? undefined}
            >
              {doc.original_filename ?? "Untitled document"}
            </div>
            <div
              style={{
                marginTop: 1,
                font: "400 11.5px var(--font-inter)",
                color: "var(--pw-text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Document type:{" "}
              <span style={{ textTransform: "capitalize" }}>
                {extraction.documentType.replace(/_/g, " ")}
              </span>
              {extraction.sections.length > 0 && (
                <>
                  {" · "}
                  {extraction.sections.length}{" "}
                  {extraction.sections.length === 1 ? "section" : "sections"}
                </>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          {/* Extraction provenance chip — model + avg confidence */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              borderRadius: 999,
              background: "var(--pw-accent-soft)",
              color: "var(--pw-accent-fg-on-soft)",
              font: "500 11.5px var(--font-inter)",
            }}
            title={`Model: ${extractionModel}`}
          >
            <Icon name="sparkles" size={11} />
            Extracted with Pawdex
            {extractionConfidence !== null && (
              <>
                <span
                  style={{
                    color: "var(--pw-accent)",
                    opacity: 0.5,
                  }}
                >
                  ·
                </span>
                <span
                  className="tnum"
                  style={{
                    color:
                      extractionConfidence < LOW_CONFIDENCE
                        ? "var(--pw-status-due-fg)"
                        : "var(--pw-accent-fg-on-soft)",
                    fontWeight: 600,
                  }}
                >
                  {(extractionConfidence * 100).toFixed(0)}%
                </span>{" "}
                avg
              </>
            )}
          </div>
          {queueTotal > 1 && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                borderRadius: 999,
                background: "var(--pw-surface-2)",
                color: "var(--pw-text-secondary)",
                font: "500 11.5px var(--font-inter)",
              }}
              title="More documents are waiting on review. We'll move to the next one after you save or discard this."
            >
              <Icon name="inbox" size={11} />
              {queueTotal} in queue
            </div>
          )}
        </div>
      </div>

      {extraction.sections.length > 0 && (
        <div
          className="pw-card"
          style={{ padding: 14, marginBottom: 16 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <h2
              style={{
                margin: 0,
                font: "600 13px var(--font-inter)",
                color: "var(--pw-text)",
              }}
            >
              What Pawdex found in this document
            </h2>
            <span
              style={{
                font: "500 11.5px var(--font-inter)",
                color: "var(--pw-text-muted)",
              }}
            >
              {extraction.sections.length}{" "}
              {extraction.sections.length === 1 ? "section" : "sections"}
            </span>
          </div>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {extraction.sections.map((s, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: 8,
                  borderRadius: 8,
                  background: "var(--pw-surface-2)",
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    padding: "2px 7px",
                    borderRadius: 4,
                    background: "var(--pw-surface)",
                    border: "1px solid var(--pw-border)",
                    font: "600 10.5px var(--font-jetbrains)",
                    color: "var(--pw-text-secondary)",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  {SECTION_TYPE_LABEL[s.section_type] ?? s.section_type}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      font: "500 12.5px var(--font-inter)",
                      color: "var(--pw-text)",
                    }}
                  >
                    {s.title}
                    {s.page_hint && (
                      <span
                        className="mono"
                        style={{
                          font: "400 11px var(--font-jetbrains)",
                          color: "var(--pw-text-muted)",
                        }}
                      >
                        · {s.page_hint}
                      </span>
                    )}
                    {s.date_hint && (
                      <span
                        className="tnum"
                        style={{
                          font: "400 11px var(--font-inter)",
                          color: "var(--pw-text-muted)",
                        }}
                      >
                        · {s.date_hint}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      marginTop: 3,
                      font: "400 12px var(--font-inter)",
                      color: "var(--pw-text-muted)",
                    }}
                  >
                    {s.summary}
                  </div>
                </div>
                <span
                  className="tnum"
                  style={{
                    flexShrink: 0,
                    font: "500 11px var(--font-inter)",
                    color:
                      s.confidence < LOW_CONFIDENCE
                        ? "var(--pw-status-due-fg)"
                        : "var(--pw-text-subtle)",
                  }}
                >
                  {(s.confidence * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dedupMatchedCount > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            marginBottom: 16,
            borderRadius: 8,
            background: "var(--pw-accent-soft)",
            border: "1px solid var(--pw-accent)",
          }}
        >
          <span style={{ color: "var(--pw-accent-fg-on-soft)" }}>
            <Icon name="checkCircle" size={15} />
          </span>
          <div
            style={{
              flex: 1,
              font: "400 12.5px var(--font-inter)",
              color: "var(--pw-text-secondary)",
              lineHeight: 1.5,
            }}
          >
            <span
              style={{ fontWeight: 600, color: "var(--pw-accent-fg-on-soft)" }}
            >
              {dedupMatchedCount}{" "}
              {dedupMatchedCount === 1 ? "record looks" : "records look"} like
              {dedupMatchedCount === 1 ? " something" : " things"} already in
              your records
            </span>{" "}
            — skipped by default so you don&rsquo;t get duplicates. Each is
            marked below; check <em>Include</em> on any that&rsquo;s actually a
            separate visit or dose.
          </div>
        </div>
      )}

      <ReviewExtensions
        labValues={extraction.lab_values ?? []}
        labDupes={labDupes}
        upcomingReminders={extraction.upcoming_reminders ?? []}
        petAttributes={extraction.pet_attributes ?? null}
        excludedBoilerplate={extraction.excluded_boilerplate ?? []}
        petAttributeDiffs={petAttributeDiffs}
        onChange={setExtensionsState}
      />

      {rabiesDetected && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 14px",
            marginBottom: 16,
            borderRadius: 8,
            background: "var(--pw-status-due-bg)",
            color: "var(--pw-status-due-fg)",
            border: "1px solid var(--pw-status-due-dot)",
          }}
        >
          <Icon name="shieldCheck" size={15} />
          <div
            style={{
              flex: 1,
              font: "400 12.5px var(--font-inter)",
              lineHeight: 1.5,
            }}
          >
            <span style={{ fontWeight: 600 }}>
              Rabies certificate detected — verify all fields against the
              original.
            </span>{" "}
            <span style={{ color: "var(--pw-text-secondary)" }}>
              This is a legal document for travel, boarding, and bites. Your
              original file is retained unmodified.
            </span>
          </div>
          <Link
            href="/help/vaccines"
            style={{
              flexShrink: 0,
              color: "var(--pw-status-due-fg)",
              font: "500 12px var(--font-inter)",
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            Learn more
          </Link>
        </div>
      )}

      {/* Two-column body */}
      <div className="review-grid">
        {/* Viewer */}
        <div
          style={{
            position: "sticky",
            top: 12,
            alignSelf: "start",
            background: "var(--pw-surface-2)",
            border: "1px solid var(--pw-border)",
            borderRadius: 10,
            overflow: "hidden",
            minHeight: 480,
          }}
        >
          {signedUrl && doc.mime_type?.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signedUrl}
              alt={doc.original_filename ?? "Document"}
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          ) : signedUrl ? (
            <iframe
              src={signedUrl}
              title={doc.original_filename ?? "Document"}
              style={{
                width: "100%",
                height: "75vh",
                border: 0,
                background: "white",
              }}
            />
          ) : (
            <div
              style={{
                padding: 24,
                font: "400 13px var(--font-inter)",
                color: "var(--pw-text-muted)",
              }}
            >
              Document preview unavailable.
            </div>
          )}
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Vet clinic */}
          <Section
            title="Vet clinic"
            count={vetClinicName.trim() ? 1 : 0}
            description="Saved to your vets directory for quick lookup later."
          >
            {extraction.owner_contact?.phone && (
              <div
                style={{
                  marginBottom: 12,
                  padding: "8px 12px",
                  background: "var(--pw-info-bg)",
                  color: "var(--pw-info-fg)",
                  borderRadius: 6,
                  font: "400 12px var(--font-inter)",
                }}
              >
                <Icon name="info" size={11} style={{ marginRight: 6 }} />
                Owner contact detected separately on this document
                {extraction.owner_contact?.phone
                  ? ` (phone ${extraction.owner_contact.phone})`
                  : ""}
                . Pawdex will drop any clinic field that matches owner info so
                we don&apos;t cross-contaminate your vets directory.
              </div>
            )}
            <FieldGrid>
              <Field label="Clinic name" span={2}>
                <input
                  type="text"
                  value={vetClinicName}
                  onChange={(e) => setVetClinicName(e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label="Phone">
                <input
                  type="text"
                  value={vetClinicPhone}
                  onChange={(e) => setVetClinicPhone(e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={vetClinicEmail}
                  onChange={(e) => setVetClinicEmail(e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label="Address" span={2}>
                <input
                  type="text"
                  value={vetClinicAddress}
                  onChange={(e) => setVetClinicAddress(e.target.value)}
                  placeholder="Street, city, state, zip"
                  style={inputStyle}
                />
              </Field>
            </FieldGrid>
          </Section>

          {vaccinations.length > 0 && (
            <Section
              title="Vaccinations"
              count={vaccinations.filter((v) => !v.skip).length}
              total={vaccinations.length}
            >
              {vaccinations.map((v, i) => (
                <DraftCard
                  key={i}
                  skip={v.skip}
                  confidence={v.confidence}
                  onToggleSkip={() =>
                    setVaccinations((rows) =>
                      rows.map((r, j) => (j === i ? { ...r, skip: !r.skip } : r)),
                    )
                  }
                  conflict={vaccineConflict(vaccineDupes[i])}
                  badge={
                    v.vaccine_type.toLowerCase().includes("rabies") ? (
                      <span
                        style={{
                          font: "600 9.5px var(--font-jetbrains)",
                          letterSpacing: "0.06em",
                          padding: "2px 5px",
                          borderRadius: 3,
                          background: "var(--pw-surface-2)",
                          color: "var(--pw-text-muted)",
                        }}
                      >
                        LEGAL
                      </span>
                    ) : null
                  }
                >
                  <FieldGrid>
                    <Field label="Vaccine type" required>
                      <input
                        type="text"
                        value={v.vaccine_type}
                        onChange={(e) =>
                          setVaccinations((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, vaccine_type: e.target.value } : r,
                            ),
                          )
                        }
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Lot number">
                      <input
                        type="text"
                        value={v.lot_number}
                        onChange={(e) =>
                          setVaccinations((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, lot_number: e.target.value } : r,
                            ),
                          )
                        }
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Administered" required>
                      <input
                        type="date"
                        value={v.administered_on}
                        onChange={(e) =>
                          setVaccinations((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, administered_on: e.target.value } : r,
                            ),
                          )
                        }
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Expires">
                      <input
                        type="date"
                        value={v.expires_on}
                        onChange={(e) =>
                          setVaccinations((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, expires_on: e.target.value } : r,
                            ),
                          )
                        }
                        style={inputStyle}
                      />
                      <ExpiryHint
                        vaccineType={v.vaccine_type}
                        administeredOn={v.administered_on}
                        currentExpiresOn={v.expires_on}
                        onUseComputed={(date) =>
                          setVaccinations((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, expires_on: date } : r,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label="Manufacturer">
                      <input
                        type="text"
                        value={v.manufacturer}
                        onChange={(e) =>
                          setVaccinations((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, manufacturer: e.target.value } : r,
                            ),
                          )
                        }
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Administering vet">
                      <input
                        type="text"
                        value={v.administering_vet}
                        onChange={(e) =>
                          setVaccinations((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, administering_vet: e.target.value } : r,
                            ),
                          )
                        }
                        style={inputStyle}
                      />
                    </Field>
                  </FieldGrid>
                </DraftCard>
              ))}
            </Section>
          )}

          {medications.length > 0 && (
            <Section
              title="Medications"
              count={medications.filter((m) => !m.skip).length}
              total={medications.length}
            >
              {medications.map((m, i) => (
                <DraftCard
                  key={i}
                  skip={m.skip}
                  confidence={m.confidence}
                  onToggleSkip={() =>
                    setMedications((rows) =>
                      rows.map((r, j) => (j === i ? { ...r, skip: !r.skip } : r)),
                    )
                  }
                  conflict={medConflict(medDupes[i])}
                >
                  <FieldGrid>
                    <Field label="Name" required>
                      <input
                        type="text"
                        value={m.name}
                        onChange={(e) =>
                          setMedications((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, name: e.target.value } : r,
                            ),
                          )
                        }
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Dose" required>
                      <input
                        type="text"
                        value={m.dose}
                        onChange={(e) =>
                          setMedications((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, dose: e.target.value } : r,
                            ),
                          )
                        }
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Frequency">
                      <input
                        type="text"
                        value={m.frequency}
                        onChange={(e) =>
                          setMedications((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, frequency: e.target.value } : r,
                            ),
                          )
                        }
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Prescriber">
                      <input
                        type="text"
                        value={m.prescriber}
                        onChange={(e) =>
                          setMedications((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, prescriber: e.target.value } : r,
                            ),
                          )
                        }
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Started" required>
                      <input
                        type="date"
                        value={m.started_on}
                        onChange={(e) =>
                          setMedications((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, started_on: e.target.value } : r,
                            ),
                          )
                        }
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Ended">
                      <input
                        type="date"
                        value={m.ended_on}
                        onChange={(e) =>
                          setMedications((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, ended_on: e.target.value } : r,
                            ),
                          )
                        }
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Indication" span={2}>
                      <input
                        type="text"
                        value={m.indication}
                        onChange={(e) =>
                          setMedications((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, indication: e.target.value } : r,
                            ),
                          )
                        }
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Duration (days)">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="e.g. 7"
                        value={m.duration_days}
                        onChange={(e) =>
                          setMedications((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, duration_days: e.target.value } : r,
                            ),
                          )
                        }
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Context">
                      <select
                        value={m.medication_context}
                        onChange={(e) =>
                          setMedications((rows) =>
                            rows.map((r, j) =>
                              j === i
                                ? {
                                    ...r,
                                    medication_context: e.target
                                      .value as MedicationContext,
                                  }
                                : r,
                            ),
                          )
                        }
                        style={inputStyle}
                      >
                        {MED_CONTEXT_OPTIONS.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </FieldGrid>
                  {(m.medication_context === "intraoperative" ||
                    m.medication_context === "injection_in_office") && (
                    <p
                      style={{
                        margin: "8px 0 0",
                        font: "400 11.5px var(--font-inter)",
                        color: "var(--pw-text-muted)",
                      }}
                    >
                      Historical — won&apos;t appear under &ldquo;Active medications.&rdquo;
                    </p>
                  )}
                </DraftCard>
              ))}
            </Section>
          )}

          {events.length > 0 && (
            <Section
              title="Medical events"
              count={events.filter((e) => !e.skip).length}
              total={events.length}
            >
              {events.map((e, i) => {
                const billing = detectBillingLine(e.title);
                return (
                <DraftCard
                  key={i}
                  skip={e.skip}
                  confidence={e.confidence}
                  onToggleSkip={() =>
                    setEvents((rows) =>
                      rows.map((r, j) => (j === i ? { ...r, skip: !r.skip } : r)),
                    )
                  }
                  conflict={eventConflict(eventDupes[i])}
                  badge={
                    billing.kind === "strong" ? (
                      <span
                        title={billing.reason}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: "var(--pw-status-due-bg)",
                          color: "var(--pw-status-due-fg)",
                          border: "1px solid var(--pw-status-due-dot)",
                          font: "600 10px var(--font-inter)",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        <Icon name="alert" size={9} />
                        Billing fee · skipped
                      </span>
                    ) : billing.kind === "soft" ? (
                      <span
                        title={billing.reason}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: "var(--pw-pending-bg)",
                          color: "var(--pw-pending-fg)",
                          border: "1px solid var(--pw-pending-border)",
                          font: "600 10px var(--font-inter)",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        Check this is clinical
                      </span>
                    ) : null
                  }
                >
                  <FieldGrid>
                    <Field label="Title" required span={2}>
                      <input
                        type="text"
                        value={e.title}
                        onChange={(ev) =>
                          setEvents((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, title: ev.target.value } : r,
                            ),
                          )
                        }
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Type">
                      <select
                        value={e.event_type}
                        onChange={(ev) =>
                          setEvents((rows) =>
                            rows.map((r, j) =>
                              j === i
                                ? {
                                    ...r,
                                    event_type:
                                      ev.target.value as MedicalEventDraft["event_type"],
                                  }
                                : r,
                            ),
                          )
                        }
                        style={inputStyle}
                      >
                        {EVENT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Date" required>
                      <input
                        type="date"
                        value={e.occurred_on}
                        onChange={(ev) =>
                          setEvents((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, occurred_on: ev.target.value } : r,
                            ),
                          )
                        }
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Diagnosis" span={2}>
                      <input
                        type="text"
                        value={e.diagnosis}
                        onChange={(ev) =>
                          setEvents((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, diagnosis: ev.target.value } : r,
                            ),
                          )
                        }
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Treatment" span={2}>
                      <input
                        type="text"
                        value={e.treatment}
                        onChange={(ev) =>
                          setEvents((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, treatment: ev.target.value } : r,
                            ),
                          )
                        }
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Attending vet">
                      <input
                        type="text"
                        value={e.attending_vet}
                        onChange={(ev) =>
                          setEvents((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, attending_vet: ev.target.value } : r,
                            ),
                          )
                        }
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Summary" span={2}>
                      <textarea
                        value={e.summary}
                        onChange={(ev) =>
                          setEvents((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, summary: ev.target.value } : r,
                            ),
                          )
                        }
                        rows={2}
                        style={{ ...inputStyle, height: "auto", padding: "8px 12px" }}
                      />
                    </Field>
                  </FieldGrid>
                </DraftCard>
                );
              })}
            </Section>
          )}

          {weights.length > 0 && (
            <Section
              title="Weight log"
              count={weights.filter((w) => !w.skip).length}
              total={weights.length}
            >
              {weights.map((w, i) => (
                <DraftCard
                  key={i}
                  skip={w.skip}
                  confidence={w.confidence}
                  onToggleSkip={() =>
                    setWeights((rows) =>
                      rows.map((r, j) => (j === i ? { ...r, skip: !r.skip } : r)),
                    )
                  }
                  conflict={weightConflict(weightDupes[i])}
                >
                  <FieldGrid>
                    <Field label="Date" required>
                      <input
                        type="date"
                        value={w.recorded_on}
                        onChange={(ev) =>
                          setWeights((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, recorded_on: ev.target.value } : r,
                            ),
                          )
                        }
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Weight (kg)" required>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={w.weight_kg}
                        onChange={(ev) =>
                          setWeights((rows) =>
                            rows.map((r, j) =>
                              j === i ? { ...r, weight_kg: ev.target.value } : r,
                            ),
                          )
                        }
                        style={inputStyle}
                      />
                    </Field>
                  </FieldGrid>
                </DraftCard>
              ))}
            </Section>
          )}

          {extraction.ambiguous_dates.length > 0 && (
            <div
              style={{
                padding: 14,
                background: "var(--pw-status-due-bg)",
                color: "var(--pw-status-due-fg)",
                borderRadius: 10,
                font: "400 12.5px var(--font-inter)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                  fontWeight: 600,
                }}
              >
                <Icon name="alert" size={13} />
                Ambiguous dates flagged
              </div>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {extraction.ambiguous_dates.map((d, i) => (
                  <li key={i}>
                    <code className="mono">{d.field_path}</code>: &ldquo;{d.raw_text}
                    &rdquo; could be {d.possible_interpretations.join(" or ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {extraction.notes && (
            <div
              style={{
                padding: 14,
                background: "var(--pw-info-bg)",
                color: "var(--pw-info-fg)",
                borderRadius: 10,
                font: "400 12.5px var(--font-inter)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                  fontWeight: 600,
                }}
              >
                <Icon name="info" size={13} />
                Model notes
              </div>
              {extraction.notes}
            </div>
          )}

          {/* Feedback widget — explicit rating + tags + free-text. Optional;
              if left blank, commit still captures the implicit value diff. */}
          <div
            className="pw-card"
            style={{
              padding: 16,
              borderColor: "var(--pw-accent-soft-2)",
              background: "var(--pw-accent-soft)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <Icon
                name="sparkles"
                size={14}
                style={{ color: "var(--pw-accent)" }}
              />
              <h3
                style={{
                  margin: 0,
                  font: "600 13px var(--font-inter)",
                  color: "var(--pw-accent-fg-on-soft)",
                }}
              >
                How did Pawdex do on this document?
              </h3>
            </div>
            <p
              style={{
                margin: "0 0 12px",
                font: "400 12px var(--font-inter)",
                color: "var(--pw-text-secondary)",
              }}
            >
              Your rating + any specific issues you flag here teach Pawdex to do
              better on the next one. Optional — leave blank to skip.
            </p>
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              {(
                [
                  { id: "great", label: "Nailed it" },
                  { id: "mostly_good", label: "Mostly good" },
                  { id: "many_errors", label: "Many errors" },
                  { id: "wrong_doctype", label: "Wrong type" },
                  { id: "unreadable", label: "Couldn't read" },
                ] as Array<{ id: ExtractionFeedbackRating; label: string }>
              ).map((r) => {
                const on = feedbackRating === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() =>
                      setFeedbackRating(on ? null : r.id)
                    }
                    style={{
                      height: 28,
                      padding: "0 10px",
                      borderRadius: 999,
                      border: `1px solid ${on ? "var(--pw-accent)" : "var(--pw-border-strong)"}`,
                      background: on ? "var(--pw-accent)" : "var(--pw-surface)",
                      color: on ? "#fff" : "var(--pw-text-secondary)",
                      font: "500 12px var(--font-inter)",
                      cursor: "pointer",
                    }}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
            {(feedbackRating === "many_errors" ||
              feedbackRating === "wrong_doctype" ||
              feedbackRating === "unreadable" ||
              feedbackTags.length > 0) && (
              <>
                <div
                  className="pw-label"
                  style={{ marginBottom: 6 }}
                >
                  What went wrong?
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                    marginBottom: 10,
                  }}
                >
                  {ISSUE_TAGS.map((t) => {
                    const on = feedbackTags.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() =>
                          setFeedbackTags((prev) =>
                            on
                              ? prev.filter((p) => p !== t.id)
                              : [...prev, t.id],
                          )
                        }
                        style={{
                          height: 26,
                          padding: "0 10px",
                          borderRadius: 999,
                          border: `1px solid ${on ? "var(--pw-text)" : "var(--pw-border-strong)"}`,
                          background: on
                            ? "var(--pw-text)"
                            : "var(--pw-surface)",
                          color: on ? "var(--pw-bg)" : "var(--pw-text-secondary)",
                          font: "500 11.5px var(--font-inter)",
                          cursor: "pointer",
                        }}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <textarea
              rows={2}
              placeholder="Anything specific Pawdex got wrong? (optional)"
              value={feedbackNotes}
              onChange={(e) => setFeedbackNotes(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid var(--pw-border-strong)",
                background: "var(--pw-surface)",
                color: "var(--pw-text)",
                font: "400 13px var(--font-inter)",
                resize: "vertical",
                outline: "none",
              }}
            />
          </div>
        </div>
      </div>

      {/* Sticky footer */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          background: "var(--pw-surface)",
          borderTop: "1px solid var(--pw-border)",
          padding: "12px 24px",
          boxShadow: "var(--pw-shadow-md)",
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: 1320,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <SentOnBehalfLockup size="sm" who="you" />
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={handleDiscard}
            disabled={isPending}
            style={{
              height: 36,
              padding: "0 14px",
              borderRadius: 6,
              border: "1px solid var(--pw-border-strong)",
              background: "transparent",
              color: "var(--pw-text-secondary)",
              font: "500 13px var(--font-inter)",
              cursor: "pointer",
            }}
          >
            Discard
          </button>
          <Link
            href={`/pets/${petId}/documents/${documentId}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 36,
              padding: "0 14px",
              borderRadius: 6,
              border: "1px solid var(--pw-border-strong)",
              background: "var(--pw-surface)",
              color: "var(--pw-text)",
              font: "500 13px var(--font-inter)",
              textDecoration: "none",
            }}
          >
            View source
          </Link>
          <button
            type="button"
            onClick={handleCommit}
            disabled={isPending || totalSelected === 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 36,
              padding: "0 16px",
              borderRadius: 6,
              background: "var(--pw-accent)",
              border: "1px solid var(--pw-accent)",
              color: "#fff",
              font: "500 13px var(--font-inter)",
              cursor: isPending ? "default" : "pointer",
              opacity: isPending || totalSelected === 0 ? 0.6 : 1,
            }}
          >
            {isPending ? "Saving…" : `Confirm & save ${totalSelected} ${totalSelected === 1 ? "item" : "items"}`}
            <Icon name="check" size={13} />
          </button>
        </div>
      </div>

      <style>{`
        .review-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 18px;
        }
        @media (min-width: 1100px) {
          .review-grid {
            grid-template-columns: minmax(0, 1fr) minmax(440px, 520px);
            gap: 24px;
          }
        }
      `}</style>

      {/* Bottom safe-area for sticky footer */}
      <div aria-hidden style={{ height: 24 }} />

      {/* Refresh button to fetch new extraction after re-running */}
      <button
        type="button"
        onClick={() => router.refresh()}
        style={{ display: "none" }}
        aria-hidden
      />
    </div>
  );
}

function Section({
  title,
  description,
  count,
  total,
  children,
}: {
  title: string;
  description?: string;
  count: number;
  total?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="pw-card" style={{ padding: 16 }}>
      <header
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              font: "600 14px var(--font-inter)",
              color: "var(--pw-text)",
            }}
          >
            {title}
          </h2>
          {description && (
            <p
              style={{
                margin: "3px 0 0",
                font: "400 12px var(--font-inter)",
                color: "var(--pw-text-muted)",
              }}
            >
              {description}
            </p>
          )}
        </div>
        <span
          style={{
            font: "500 11.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          {total !== undefined ? `${count} of ${total} selected` : `${count} on file`}
        </span>
      </header>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {children}
      </div>
    </section>
  );
}

function DraftCard({
  skip,
  confidence,
  onToggleSkip,
  badge,
  conflict,
  children,
}: {
  skip: boolean;
  confidence: number;
  onToggleSkip: () => void;
  badge?: React.ReactNode;
  conflict?: React.ReactNode;
  children: React.ReactNode;
}) {
  const low = confidence < LOW_CONFIDENCE;
  return (
    <div
      style={{
        border: conflict
          ? "1px solid var(--pw-status-due-dot)"
          : "1px solid var(--pw-border)",
        borderRadius: 10,
        padding: 12,
        background: skip
          ? "var(--pw-surface-2)"
          : low
            ? "rgba(246, 233, 210, 0.35)"
            : "var(--pw-surface)",
        opacity: skip ? 0.5 : 1,
        transition: "opacity .12s, background .12s",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            font: "500 11.5px var(--font-inter)",
            color: skip ? "var(--pw-text-muted)" : "var(--pw-text)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={!skip}
            onChange={onToggleSkip}
            style={{ accentColor: "var(--pw-accent)" }}
          />
          {skip ? "Skip" : "Include"}
        </label>
        {badge}
        <div style={{ flex: 1 }} />
        <span
          className="tnum"
          style={{
            font: "500 10.5px var(--font-inter)",
            color: low ? "var(--pw-status-due-fg)" : "var(--pw-text-subtle)",
            padding: "2px 6px",
            borderRadius: 999,
            background: low ? "var(--pw-status-due-bg)" : "transparent",
          }}
        >
          {(confidence * 100).toFixed(0)}% conf.
        </span>
      </div>
      {conflict}
      {children}
    </div>
  );
}

/**
 * Conflict banner rendered inside an entity card when the row looks like a
 * record already on file. Explains WHY it was matched + what it matched
 * against, and notes that it's skipped by default but the user can include it.
 */
function ConflictBanner({
  strength,
  summary,
  detail,
}: {
  strength: "exact" | "strong" | "loose";
  summary: string;
  detail: string | null;
}) {
  const high = strength === "exact" || strength === "strong";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "8px 10px",
        marginBottom: 10,
        borderRadius: 8,
        background: "var(--pw-status-due-bg)",
        border: "1px solid var(--pw-status-due-dot)",
      }}
    >
      <span style={{ color: "var(--pw-status-due-fg)", marginTop: 1 }}>
        <Icon name="copy" size={13} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            font: "600 11.5px var(--font-inter)",
            color: "var(--pw-status-due-fg)",
          }}
        >
          {summary}
        </div>
        {detail && (
          <div
            style={{
              marginTop: 2,
              font: "400 11px var(--font-inter)",
              color: "var(--pw-text-secondary)",
            }}
          >
            {detail}
          </div>
        )}
        <div
          style={{
            marginTop: 3,
            font: "400 10.5px var(--font-inter)",
            color: "var(--pw-text-muted)",
          }}
        >
          {high
            ? "Skipped by default to avoid a duplicate — check Include if this is a separate dose."
            : "Possible duplicate — review before including."}
        </div>
      </div>
    </div>
  );
}

function dayLabel(d: number): string {
  return d < 1 ? " · same day" : ` · ${Math.round(d)}d apart`;
}

function vaccineConflict(matches: VaccineMatch[] | undefined): React.ReactNode {
  if (!matches || matches.length === 0) return null;
  const m = matches[0];
  return (
    <ConflictBanner
      strength={m.match_strength}
      summary={`Already on file: ${m.vaccine_type}`}
      detail={`Given ${m.administered_on}${m.vet_clinic_name ? ` · ${m.vet_clinic_name}` : ""}${dayLabel(m.days_apart)}`}
    />
  );
}

function eventConflict(matches: MedicalEventMatch[] | undefined): React.ReactNode {
  if (!matches || matches.length === 0) return null;
  const m = matches[0];
  return (
    <ConflictBanner
      strength={m.match_strength}
      summary={`Already on file: ${m.title}`}
      detail={`${m.occurred_on}${m.vet_clinic_name ? ` · ${m.vet_clinic_name}` : ""}${dayLabel(m.days_apart)}`}
    />
  );
}

function weightConflict(matches: WeightMatch[] | undefined): React.ReactNode {
  if (!matches || matches.length === 0) return null;
  const m = matches[0];
  const kg = Number(m.weight_kg);
  return (
    <ConflictBanner
      strength={m.match_strength}
      summary={`Already on file: ${kg.toFixed(2)} kg on ${m.recorded_on}`}
      detail={
        m.kg_delta !== null && m.kg_delta > 0.05
          ? `This document reads ${m.kg_delta.toFixed(2)} kg differently — could be a re-measurement.`
          : null
      }
    />
  );
}

function medConflict(matches: MedicationMatch[] | undefined): React.ReactNode {
  if (!matches || matches.length === 0) return null;
  const m = matches[0];
  // No dayLabel here — the candidate's start date isn't always present (PIMS
  // current-meds blocks omit it), so a day comparison would mislead. Show the
  // existing row's own start + dose, which is informative on its own.
  return (
    <ConflictBanner
      strength={m.match_strength}
      summary={`Already on file: ${m.name}`}
      detail={`Started ${m.started_on}${m.dose ? ` · ${m.dose}` : ""}`}
    />
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 10,
      }}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  span,
  children,
}: {
  label: string;
  required?: boolean;
  span?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        gridColumn: span === 2 ? "span 2" : undefined,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        font: "500 11px var(--font-inter)",
        color: "var(--pw-text-muted)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      <span>
        {label}
        {required && (
          <span style={{ color: "var(--pw-status-overdue-fg)", marginLeft: 4 }}>
            *
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 34,
  padding: "0 10px",
  borderRadius: 6,
  border: "1px solid var(--pw-border-strong)",
  background: "var(--pw-surface)",
  color: "var(--pw-text)",
  font: "400 13px var(--font-inter)",
  letterSpacing: 0,
  textTransform: "none",
  outline: "none",
};

/**
 * Inline hint surfaced under the Expires field on a vaccine card. When the
 * extractor didn't populate expires_on AND the type maps to a known family,
 * shows the catalog-computed expiry with a one-click "Use" button. When the
 * user has already entered an expiry, the hint stays out of the way.
 */
function ExpiryHint({
  vaccineType,
  administeredOn,
  currentExpiresOn,
  onUseComputed,
}: {
  vaccineType: string;
  administeredOn: string;
  currentExpiresOn: string;
  onUseComputed: (date: string) => void;
}) {
  if (currentExpiresOn.trim()) {
    return null;
  }
  if (!administeredOn || !vaccineType.trim()) return null;
  const family = inferFamilyFromType(vaccineType);
  const computed = computeExpiryFromFamily({
    family,
    administered_on: administeredOn,
  });
  if (!computed) return null;

  return (
    <div
      style={{
        marginTop: 4,
        font: "400 11px var(--font-inter)",
        color: "var(--pw-text-muted)",
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap",
      }}
    >
      <span>
        Catalog default: <strong>{computed.expires_on}</strong> (
        {computed.duration_months} mo
        {computed.is_first_dose ? ", first dose" : ""})
      </span>
      <button
        type="button"
        onClick={() => onUseComputed(computed.expires_on)}
        style={{
          font: "500 11px var(--font-inter)",
          color: "var(--pw-accent)",
          background: "transparent",
          border: 0,
          cursor: "pointer",
          padding: 0,
          textDecoration: "underline",
          textUnderlineOffset: 2,
        }}
      >
        Use this
      </button>
      {computed.legally_sensitive && (
        <span
          style={{
            font: "500 10px var(--font-jetbrains-mono)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "#b54a4a",
          }}
          title="Rabies expiration is governed by state law. Verify before relying on the default."
        >
          verify state law
        </span>
      )}
    </div>
  );
}
