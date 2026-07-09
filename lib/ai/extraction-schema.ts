import { z } from "zod";

// All field-level confidences live on the leaf records. confidence_overall
// is the model's holistic read on the entire document and drives tier escalation.

// v6.1.0 — Every leaf record now carries `source_page` + `source_quote` so the
// review UI can render click-to-highlight citations and so we can verify
// extracted values against the source bytes. Required by the citation
// requirement in the prompt — models are instructed to leave these null if
// they can't quote the value verbatim from the document.
const citationShape = {
  source_page: z
    .number()
    .int()
    .nullable()
    .describe(
      "1-indexed page number where this value appears. Null when the document is single-page or the page can't be identified.",
    ),
  source_quote: z
    .string()
    .nullable()
    .describe(
      "The verbatim text from the document this value was extracted from. Required when the field is filled — if you can't quote it, leave the field null. ~80 char excerpt is fine.",
    ),
};

const documentTypeEnum = z.enum([
  "vaccine_certificate",
  "vet_visit_summary",
  "lab_result",
  "invoice",
  "prescription",
  "imaging",
  "adoption_record",
  "microchip_record",
  "other",
  "unknown",
]);

const sectionTypeEnum = z.enum([
  "vaccine_block",
  "visit_summary",
  "soap_note",
  "lab_panel",
  "imaging_report",
  "prescription",
  "dental_record",
  "surgical_report",
  "discharge_summary",
  "invoice_section",
  "microchip_record",
  "notes",
  "header_footer",
  "other",
]);

// Sections describe the *structure* of a document — a single PDF can be a
// vaccine cert (one section), a SOAP note (one structured section), or a
// multi-visit medical record (many sections). The review UI groups extracted
// entities by their owning section.
const sectionSchema = z.object({
  section_type: sectionTypeEnum,
  // Short human-readable title — "April 14 wellness visit", "Rabies booster",
  // "CBC + chemistry panel". Models should write these like a competent vet tech.
  title: z.string(),
  // Page range hint when known ("p. 3", "pp. 4–6"). Free text — providers
  // don't always know exact pages.
  page_hint: z.string().nullable(),
  // The date this section refers to (different from the document's own date).
  // ISO format when extractable; null when not present.
  date_hint: z.string().nullable(),
  // 1–2 sentence summary of what's in this section in plain English.
  summary: z.string(),
  confidence: z.number().describe("Confidence in [0, 1]."),
});

const petDetectedSchema = z.object({
  name_or_identifier: z.string(),
  species_guess: z.enum(["dog", "cat", "other"]).nullable(),
});

const vaccinationSchema = z.object({
  vaccine_type: z.string(),
  administered_on: z.string(),
  expires_on: z.string().nullable(),
  lot_number: z.string().nullable(),
  manufacturer: z.string().nullable(),
  administering_vet: z.string().nullable(),
  clinic_name: z.string().nullable(),
  // Optional pointer to the section this row came from. Free-text title match
  // is brittle; models are encouraged to repeat the section's title verbatim.
  source_section: z.string().nullable(),
  ...citationShape,
  confidence: z.number().describe("Confidence in [0, 1]."),
});

const medicationContextEnum = z.enum([
  "prescribed_takehome",
  "intraoperative",
  "injection_in_office",
  "otc_recommended",
  "unknown",
]);

const medicationSchema = z.object({
  name: z.string(),
  generic_name: z.string().nullable(),
  dose: z.string(),
  route: z.string().nullable(),
  frequency: z.string().nullable(),
  // Duration in days when the document specifies one ("x 7 days", "for 14 days",
  // "BID x 10d"). Used to compute ended_on when ended_on isn't explicit.
  duration_days: z.number().int().nullable(),
  started_on: z.string().nullable(),
  ended_on: z.string().nullable(),
  prescriber: z.string().nullable(),
  indication: z.string().nullable(),
  // Critical for the "is this medication still active?" question. Intraoperative
  // anesthesia + injections given AT the visit are NOT active medications the
  // owner needs to track. Only prescribed_takehome rows surface in the
  // "Active medications" UI.
  medication_context: medicationContextEnum,
  source_section: z.string().nullable(),
  ...citationShape,
  confidence: z.number().describe("Confidence in [0, 1]."),
});

const medicalEventSchema = z.object({
  event_type: z.enum([
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
  ]),
  occurred_on: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  diagnosis: z.string().nullable(),
  treatment: z.string().nullable(),
  attending_vet: z.string().nullable(),
  clinic_name: z.string().nullable(),
  source_section: z.string().nullable(),
  ...citationShape,
  confidence: z.number().describe("Confidence in [0, 1]."),
});

const weightSchema = z.object({
  recorded_on: z.string(),
  weight_kg: z.number().nullable(),
  weight_lbs: z.number().nullable(),
  source_section: z.string().nullable(),
  ...citationShape,
  confidence: z.number().describe("Confidence in [0, 1]."),
});

const vetClinicSchema = z
  .object({
    name: z.string(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    address: z.string().nullable(),
  })
  .nullable();

// Owner / client contact info, extracted separately so the commit-side can
// detect when a phone or address was mistakenly attributed to the vet clinic
// (a common failure mode on documents that include both letterhead and a
// patient/client info block).
const ownerContactSchema = z
  .object({
    name: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    address: z.string().nullable(),
  })
  .nullable();

const ambiguousDateSchema = z.object({
  field_path: z.string(),
  raw_text: z.string(),
  possible_interpretations: z.array(z.string()),
});

// Structured per-analyte lab values from in-house panels (CBC, chem, fecal,
// urinalysis, 4Dx SNAP, T4, etc.). Pawdex's lab_values table renders these as
// trend charts (Phase 6.18). When the model sees a Test | Result | Flag |
// Normal Range table, every row is one lab_value row.
const labValueSchema = z.object({
  analyte: z.string().describe(
    "Name of the analyte as printed (e.g. 'Creatinine', 'ALT', 'WBC', 'SDMA').",
  ),
  value: z.number().nullable().describe(
    "Numeric result. Null when the result is qualitative (e.g. 'Negative', 'Trace').",
  ),
  // v6.1 — explicit operator handling. IDEXX prints '<20', '>1000' for
  // off-scale results; without this column the value was being stored as
  // the bare number, which silently rounds a critically-low to a borderline.
  // Capture the operator so downstream logic can flag accordingly.
  operator: z
    .enum(["<", "<=", "=", ">=", ">"])
    .nullable()
    .describe(
      "Operator when the report prints one — '<20' or '>1000' for off-scale results. Null when the value is direct (i.e. '12.4').",
    ),
  value_text: z.string().nullable().describe(
    "Qualitative or raw text result when not numeric — 'Negative', 'H', 'L', 'QNS', 'PEND', etc.",
  ),
  units: z.string().nullable(),
  reference_low: z.number().nullable(),
  reference_high: z.number().nullable(),
  flag: z.string().nullable().describe(
    "H / L / HH / LL / normal / * — whatever the report prints. IDEXX uses H/L, Antech sometimes uses HH/LL for critical.",
  ),
  collected_on: z.string().describe(
    "ISO YYYY-MM-DD. Inherit from the panel header if not on the row itself.",
  ),
  lab: z.string().nullable().describe(
    "Reference lab name when stated (IDEXX, Antech) or 'In-house' for clinic-internal.",
  ),
  source_section: z.string().nullable(),
  ...citationShape,
  confidence: z.number().describe("Confidence in [0, 1]."),
});

// Forward-looking reminders that the document explicitly lists in a
// "due / reminders / next visit" block. Distinct from things Pawdex derives
// from vaccine expiry — these are direct extractions.
const upcomingReminderSchema = z.object({
  title: z.string().describe(
    "What's due. Capture verbatim from the document, e.g. 'Canine Rabies 3 Year Vaccine'.",
  ),
  due_on: z.string().describe("ISO YYYY-MM-DD."),
  last_done_on: z.string().nullable(),
  entity_type: z
    .enum(["vaccine", "exam", "lab", "preventative", "other"])
    .describe("Best guess at category, used for grouping."),
  source_section: z.string().nullable(),
  confidence: z.number().describe("Confidence in [0, 1]."),
});

// What the document CLAIMS about pet identity (breed, DOB, microchip, etc.).
// Separate from the canonical pets row — the review UI shows diffs and lets
// the owner accept or reject each field.
const petAttributesSchema = z
  .object({
    breed: z.string().nullable(),
    sex: z.enum(["male", "female", "unknown"]).nullable(),
    altered: z.boolean().nullable(),
    date_of_birth: z.string().nullable().describe("ISO YYYY-MM-DD."),
    microchip_number: z.string().nullable(),
    microchip_registry: z.string().nullable(),
    microchip_implanted_on: z.string().nullable(),
    color: z.string().nullable(),
    confidence: z.number().describe("Confidence in [0, 1]."),
  })
  .nullable();

// Marks blocks of patient-education boilerplate the model recognized and
// excluded from medical_events. Surfaces in the review UI so the user knows
// what got filtered.
const boilerplateBlockSchema = z.object({
  source_section: z.string().nullable(),
  topic: z.string().describe(
    "Short topic name — 'Heartworm Prevention education', 'Vaccine side-effects standard copy', 'Spay/Neuter education'.",
  ),
  reason: z.string().describe(
    "Why this was excluded — typically 'template education copy, not patient-specific finding'.",
  ),
});

// Single flat schema (not a discriminated union — Gemini's structured output
// handles unions poorly). `documentType` is a plain enum field; downstream
// switches on it normally.
export const extractionResultSchema = z.object({
  documentType: documentTypeEnum,
  confidence_overall: z.number().describe("Confidence in [0, 1]."),
  // Sections — the structure of what the model saw. Always present, even for
  // single-section docs like a vaccine cert (one section_type="vaccine_block").
  sections: z.array(sectionSchema),
  pets_detected: z.array(petDetectedSchema),
  vaccinations: z.array(vaccinationSchema),
  medications: z.array(medicationSchema),
  medical_events: z.array(medicalEventSchema),
  weights: z.array(weightSchema),
  // New in v6 — structured per-analyte lab values for the lab_values table.
  lab_values: z.array(labValueSchema),
  // New in v6 — forward-looking reminders explicitly listed in the document.
  upcoming_reminders: z.array(upcomingReminderSchema),
  // New in v6 — what the document claims about pet identity, for review-time
  // reconciliation with the canonical pets row.
  pet_attributes: petAttributesSchema,
  // New in v6 — patient-education boilerplate the model recognized and
  // excluded from medical_events. Surfaces in the review UI.
  excluded_boilerplate: z.array(boilerplateBlockSchema),
  vet_clinic: vetClinicSchema,
  owner_contact: ownerContactSchema,
  notes: z.string(),
  ambiguous_dates: z.array(ambiguousDateSchema),
});

export type ExtractionResult = z.infer<typeof extractionResultSchema>;
export type DocumentType = z.infer<typeof documentTypeEnum>;
export type SectionType = z.infer<typeof sectionTypeEnum>;
export type ExtractedSection = z.infer<typeof sectionSchema>;
export type ExtractedVaccination = z.infer<typeof vaccinationSchema>;
export type ExtractedMedication = z.infer<typeof medicationSchema>;
export type ExtractedMedicalEvent = z.infer<typeof medicalEventSchema>;
export type ExtractedWeight = z.infer<typeof weightSchema>;
export type ExtractedLabValue = z.infer<typeof labValueSchema>;
export type ExtractedUpcomingReminder = z.infer<typeof upcomingReminderSchema>;
export type ExtractedPetAttributes = z.infer<typeof petAttributesSchema>;
export type ExtractedBoilerplateBlock = z.infer<typeof boilerplateBlockSchema>;
