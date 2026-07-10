// Re-exports the generated Supabase Database type and exposes convenience Row aliases.
// To refresh after schema changes:
//   pnpm dlx supabase gen types typescript --project-id <ref> > lib/supabase/types.gen.ts
// or use the Supabase MCP `generate_typescript_types` tool.

export type { Database, Json } from "@/lib/supabase/types.gen";

import type { Database } from "@/lib/supabase/types.gen";

// Row aliases — use these throughout the app for ergonomic typing.
export type Household = Database["public"]["Tables"]["households"]["Row"];
export type HouseholdMember = Database["public"]["Tables"]["household_members"]["Row"];
export type Pet = Database["public"]["Tables"]["pets"]["Row"];
export type WeightEntry = Database["public"]["Tables"]["weight_log"]["Row"];
export type Vaccination = Database["public"]["Tables"]["vaccinations"]["Row"];
export type MedicalEvent = Database["public"]["Tables"]["medical_events"]["Row"];
export type Medication = Database["public"]["Tables"]["medications"]["Row"];
export type VetClinic = Database["public"]["Tables"]["vet_clinics"]["Row"];
export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
export type DocumentExtraction = Database["public"]["Tables"]["document_extractions"]["Row"];
export type DocumentPetLink = Database["public"]["Tables"]["document_pet_links"]["Row"];
export type Reminder = Database["public"]["Tables"]["reminders"]["Row"];
export type ReminderPreferences = Database["public"]["Tables"]["reminder_preferences"]["Row"];

// `medications.is_active` is computed in the app (Postgres rejected the generated column
// because `current_date` is non-immutable). See lib/utils.ts → isMedicationActive.
export type MedicationWithActive = Medication & { is_active: boolean };

export type ExtractionFeedback = Database["public"]["Tables"]["extraction_feedback"]["Row"];
export type ExtractionFeedbackInsert = Database["public"]["Tables"]["extraction_feedback"]["Insert"];
export type ExtractionFeedbackRating = Database["public"]["Enums"]["extraction_feedback_rating"];

export type MedicationContext = Database["public"]["Enums"]["medication_context"];

export type AuditLog = Database["public"]["Tables"]["audit_log"]["Row"];
export type AuditLogInsert = Database["public"]["Tables"]["audit_log"]["Insert"];
export type AuditAction = Database["public"]["Enums"]["audit_action"];

export type HouseholdInvitation = Database["public"]["Tables"]["household_invitations"]["Row"];
export type HouseholdInvitationInsert =
  Database["public"]["Tables"]["household_invitations"]["Insert"];

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];

// Phase 5 — authorizations, outbound email, insurance, cost estimates, doc Q&A, inbound routing.
export type Authorization = Database["public"]["Tables"]["authorizations"]["Row"];
export type AuthorizationInsert = Database["public"]["Tables"]["authorizations"]["Insert"];
export type AuthorizationType = Database["public"]["Enums"]["authorization_type"];

export type OutboundEmail = Database["public"]["Tables"]["outbound_emails"]["Row"];
export type OutboundEmailInsert = Database["public"]["Tables"]["outbound_emails"]["Insert"];
export type OutboundEmailStatus = Database["public"]["Enums"]["outbound_email_status"];
export type OutboundRecipientType = Database["public"]["Enums"]["outbound_recipient_type"];

export type InsurancePolicy = Database["public"]["Tables"]["insurance_policies"]["Row"];
export type InsurancePolicyInsert = Database["public"]["Tables"]["insurance_policies"]["Insert"];

export type CostEstimate = Database["public"]["Tables"]["cost_estimates"]["Row"];
export type CostEstimateInsert = Database["public"]["Tables"]["cost_estimates"]["Insert"];
export type CostEstimateStatus = Database["public"]["Enums"]["cost_estimate_status"];

export type ExtractionChunk = Database["public"]["Tables"]["extraction_chunks"]["Row"];
export type ExtractionChunkInsert = Database["public"]["Tables"]["extraction_chunks"]["Insert"];

export type PendingRecordsRequest = Database["public"]["Tables"]["pending_records_requests"]["Row"];
export type PendingRecordsRequestInsert =
  Database["public"]["Tables"]["pending_records_requests"]["Insert"];
export type PendingRequestStatus = Database["public"]["Enums"]["pending_request_status"];

export type HouseholdInboundAddress =
  Database["public"]["Tables"]["household_inbound_addresses"]["Row"];
export type HouseholdInboundAddressInsert =
  Database["public"]["Tables"]["household_inbound_addresses"]["Insert"];

export type QolEntry = Database["public"]["Tables"]["qol_entries"]["Row"];
export type QolEntryInsert = Database["public"]["Tables"]["qol_entries"]["Insert"];

export type ShareLink = Database["public"]["Tables"]["share_links"]["Row"];
export type ShareLinkInsert = Database["public"]["Tables"]["share_links"]["Insert"];
export type ShareScope = Database["public"]["Enums"]["share_scope"];

export type MedicationAdministration =
  Database["public"]["Tables"]["medication_administrations"]["Row"];
export type MedicationAdministrationInsert =
  Database["public"]["Tables"]["medication_administrations"]["Insert"];

export type MedicationPriceQuote =
  Database["public"]["Tables"]["medication_price_quotes"]["Row"];
export type MedicationPriceQuoteInsert =
  Database["public"]["Tables"]["medication_price_quotes"]["Insert"];
export type PharmacySource = Database["public"]["Enums"]["pharmacy_source"];

export type Claim = Database["public"]["Tables"]["claims"]["Row"];
export type ClaimInsert = Database["public"]["Tables"]["claims"]["Insert"];
export type ClaimStatus = Database["public"]["Enums"]["claim_status"];
export type ClaimAttachment =
  Database["public"]["Tables"]["claim_attachments"]["Row"];

export type LabValue = Database["public"]["Tables"]["lab_values"]["Row"];
export type LabValueInsert =
  Database["public"]["Tables"]["lab_values"]["Insert"];
