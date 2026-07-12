import type {
  ExtractionResult,
  ExtractedMedicalEvent,
} from "@/lib/ai/extraction-schema";

// Implicit feedback: what did the user change between the model's extraction
// and the values they actually committed? This drives prompt + tier-routing
// improvements over time (without the user having to explicitly call out
// every fix).

type ChangedField = {
  field: string;
  before: unknown;
  after: unknown;
};

export type ValueDiff = {
  vaccinations: Array<{ index: number; changes: ChangedField[]; skipped: boolean }>;
  medications: Array<{ index: number; changes: ChangedField[]; skipped: boolean }>;
  medical_events: Array<{ index: number; changes: ChangedField[]; skipped: boolean }>;
  weights: Array<{ index: number; changes: ChangedField[]; skipped: boolean }>;
  vet_clinic_changed: boolean;
};

export type CommittedDraft = {
  vaccinations: Array<{
    skip: boolean;
    vaccine_type: string;
    administered_on: string;
    expires_on: string | null;
    lot_number: string | null;
    manufacturer: string | null;
    administering_vet: string | null;
  }>;
  medications: Array<{
    skip: boolean;
    name: string;
    dose: string;
    frequency: string | null;
    started_on: string;
    ended_on: string | null;
    duration_days: number | null;
    total_doses?: number | null;
    medication_context:
      | "prescribed_takehome"
      | "intraoperative"
      | "injection_in_office"
      | "otc_recommended"
      | "unknown";
    prescriber: string | null;
    indication: string | null;
  }>;
  medical_events: Array<{
    skip: boolean;
    event_type: ExtractedMedicalEvent["event_type"];
    occurred_on: string;
    title: string;
    summary: string | null;
    diagnosis: string | null;
    treatment: string | null;
    attending_vet: string | null;
  }>;
  weights: Array<{
    skip: boolean;
    recorded_on: string;
    weight_kg: number;
  }>;
  vetClinic: { name: string; phone: string | null } | null;
};

function normalize(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? null : t;
  }
  if (typeof v === "number") return Number.isNaN(v) ? null : v;
  return v;
}

function diffFields(
  extracted: Record<string, unknown>,
  committed: Record<string, unknown>,
  fields: string[],
): ChangedField[] {
  const out: ChangedField[] = [];
  for (const f of fields) {
    const a = normalize(extracted[f]);
    const b = normalize(committed[f]);
    if (a !== b) out.push({ field: f, before: a, after: b });
  }
  return out;
}

export function computeValueDiff(
  extraction: ExtractionResult,
  committed: CommittedDraft,
): ValueDiff {
  const vaccFields = [
    "vaccine_type",
    "administered_on",
    "expires_on",
    "lot_number",
    "manufacturer",
    "administering_vet",
  ];
  const medFields = [
    "name",
    "dose",
    "frequency",
    "started_on",
    "ended_on",
    "prescriber",
    "indication",
  ];
  const eventFields = [
    "event_type",
    "occurred_on",
    "title",
    "summary",
    "diagnosis",
    "treatment",
    "attending_vet",
  ];

  return {
    vaccinations: extraction.vaccinations.map((e, i) => ({
      index: i,
      skipped: committed.vaccinations[i]?.skip ?? true,
      changes: committed.vaccinations[i]
        ? diffFields(
            e as unknown as Record<string, unknown>,
            committed.vaccinations[i] as unknown as Record<string, unknown>,
            vaccFields,
          )
        : [],
    })),
    medications: extraction.medications.map((e, i) => ({
      index: i,
      skipped: committed.medications[i]?.skip ?? true,
      changes: committed.medications[i]
        ? diffFields(
            e as unknown as Record<string, unknown>,
            committed.medications[i] as unknown as Record<string, unknown>,
            medFields,
          )
        : [],
    })),
    medical_events: extraction.medical_events.map((e, i) => ({
      index: i,
      skipped: committed.medical_events[i]?.skip ?? true,
      changes: committed.medical_events[i]
        ? diffFields(
            e as unknown as Record<string, unknown>,
            committed.medical_events[i] as unknown as Record<string, unknown>,
            eventFields,
          )
        : [],
    })),
    weights: extraction.weights.map((e, i) => {
      const c = committed.weights[i];
      const extractedKg =
        e.weight_kg ??
        (e.weight_lbs ? e.weight_lbs / 2.20462 : null);
      const changes: ChangedField[] = [];
      if (c) {
        if (normalize(e.recorded_on) !== normalize(c.recorded_on)) {
          changes.push({
            field: "recorded_on",
            before: e.recorded_on,
            after: c.recorded_on,
          });
        }
        const kgRound = (n: number | null) =>
          n == null ? null : Math.round(n * 1000) / 1000;
        if (kgRound(extractedKg) !== kgRound(c.weight_kg)) {
          changes.push({
            field: "weight_kg",
            before: extractedKg,
            after: c.weight_kg,
          });
        }
      }
      return {
        index: i,
        skipped: c?.skip ?? true,
        changes,
      };
    }),
    vet_clinic_changed:
      normalize(extraction.vet_clinic?.name ?? null) !==
        normalize(committed.vetClinic?.name ?? null) ||
      normalize(extraction.vet_clinic?.phone ?? null) !==
        normalize(committed.vetClinic?.phone ?? null),
  };
}

/**
 * One-line headline describing how much the user changed. Used for analytics
 * + the toast/log line.
 */
export function summarizeDiff(diff: ValueDiff): string {
  let changedRows = 0;
  let skippedRows = 0;
  for (const group of [
    diff.vaccinations,
    diff.medications,
    diff.medical_events,
    diff.weights,
  ]) {
    for (const row of group) {
      if (row.skipped) skippedRows++;
      else if (row.changes.length > 0) changedRows++;
    }
  }
  return `${changedRows} rows edited, ${skippedRows} skipped${
    diff.vet_clinic_changed ? ", vet clinic changed" : ""
  }`;
}
