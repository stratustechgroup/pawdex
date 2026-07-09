// Generated from Supabase project ozexfuawzqjcjgdhgrqx via:
//   pnpm dlx supabase gen types typescript --project-id <ref>
// Or via the MCP tool generate_typescript_types. Regenerate after schema changes.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      document_extractions: {
        Row: {
          committed_at: string | null;
          committed_by: string | null;
          confidence_overall: number | null;
          document_id: string;
          extracted_at: string;
          household_id: string;
          id: string;
          model: string;
          model_version: string | null;
          prompt_version: string;
          raw_response: Json;
          status: Database["public"]["Enums"]["extraction_status"];
        };
        Insert: {
          committed_at?: string | null;
          committed_by?: string | null;
          confidence_overall?: number | null;
          document_id: string;
          extracted_at?: string;
          household_id: string;
          id?: string;
          model: string;
          model_version?: string | null;
          prompt_version: string;
          raw_response: Json;
          status?: Database["public"]["Enums"]["extraction_status"];
        };
        Update: {
          committed_at?: string | null;
          committed_by?: string | null;
          confidence_overall?: number | null;
          document_id?: string;
          extracted_at?: string;
          household_id?: string;
          id?: string;
          model?: string;
          model_version?: string | null;
          prompt_version?: string;
          raw_response?: Json;
          status?: Database["public"]["Enums"]["extraction_status"];
        };
        Relationships: [];
      };
      document_pet_links: {
        Row: { document_id: string; household_id: string; pet_id: string };
        Insert: { document_id: string; household_id: string; pet_id: string };
        Update: { document_id?: string; household_id?: string; pet_id?: string };
        Relationships: [];
      };
      documents: {
        Row: {
          byte_size: number | null;
          confirmed_at: string | null;
          content_hash: string | null;
          created_by: string | null;
          doc_type: Database["public"]["Enums"]["document_type"];
          error_message: string | null;
          extraction_attempts: number;
          household_id: string;
          id: string;
          mime_type: string | null;
          original_filename: string | null;
          pet_id: string | null;
          processed_at: string | null;
          processing_status: Database["public"]["Enums"]["processing_status"];
          storage_bucket: string;
          storage_path: string;
          updated_at: string;
          uploaded_at: string;
        };
        Insert: {
          byte_size?: number | null;
          confirmed_at?: string | null;
          content_hash?: string | null;
          created_by?: string | null;
          doc_type?: Database["public"]["Enums"]["document_type"];
          error_message?: string | null;
          extraction_attempts?: number;
          household_id: string;
          id?: string;
          mime_type?: string | null;
          original_filename?: string | null;
          pet_id?: string | null;
          processed_at?: string | null;
          processing_status?: Database["public"]["Enums"]["processing_status"];
          storage_bucket?: string;
          storage_path: string;
          updated_at?: string;
          uploaded_at?: string;
        };
        Update: {
          byte_size?: number | null;
          confirmed_at?: string | null;
          content_hash?: string | null;
          created_by?: string | null;
          doc_type?: Database["public"]["Enums"]["document_type"];
          error_message?: string | null;
          extraction_attempts?: number;
          household_id?: string;
          id?: string;
          mime_type?: string | null;
          original_filename?: string | null;
          pet_id?: string | null;
          processed_at?: string | null;
          processing_status?: Database["public"]["Enums"]["processing_status"];
          storage_bucket?: string;
          storage_path?: string;
          updated_at?: string;
          uploaded_at?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"];
          actor_id: string | null;
          created_at: string;
          diff: Json;
          entity_id: string | null;
          entity_type: string;
          household_id: string;
          id: string;
        };
        Insert: {
          action: Database["public"]["Enums"]["audit_action"];
          actor_id?: string | null;
          created_at?: string;
          diff?: Json;
          entity_id?: string | null;
          entity_type: string;
          household_id: string;
          id?: string;
        };
        Update: {
          action?: Database["public"]["Enums"]["audit_action"];
          actor_id?: string | null;
          created_at?: string;
          diff?: Json;
          entity_id?: string | null;
          entity_type?: string;
          household_id?: string;
          id?: string;
        };
        Relationships: [];
      };
      household_invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          household_id: string;
          id: string;
          invited_by: string | null;
          revoked_at: string | null;
          role: Database["public"]["Enums"]["household_role"];
          token_hash: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email: string;
          expires_at: string;
          household_id: string;
          id?: string;
          invited_by?: string | null;
          revoked_at?: string | null;
          role?: Database["public"]["Enums"]["household_role"];
          token_hash: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          household_id?: string;
          id?: string;
          invited_by?: string | null;
          revoked_at?: string | null;
          role?: Database["public"]["Enums"]["household_role"];
          token_hash?: string;
        };
        Relationships: [];
      };
      extraction_feedback: {
        Row: {
          created_at: string;
          created_by: string | null;
          document_id: string;
          extraction_id: string;
          extraction_model: string;
          extraction_prompt_version: string;
          household_id: string;
          id: string;
          issue_notes: string | null;
          issue_tags: string[];
          rating: Database["public"]["Enums"]["extraction_feedback_rating"];
          value_diff: Json;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          document_id: string;
          extraction_id: string;
          extraction_model: string;
          extraction_prompt_version: string;
          household_id: string;
          id?: string;
          issue_notes?: string | null;
          issue_tags?: string[];
          rating: Database["public"]["Enums"]["extraction_feedback_rating"];
          value_diff?: Json;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          document_id?: string;
          extraction_id?: string;
          extraction_model?: string;
          extraction_prompt_version?: string;
          household_id?: string;
          id?: string;
          issue_notes?: string | null;
          issue_tags?: string[];
          rating?: Database["public"]["Enums"]["extraction_feedback_rating"];
          value_diff?: Json;
        };
        Relationships: [];
      };
      household_members: {
        Row: {
          accepted_at: string | null;
          household_id: string;
          invited_at: string;
          role: Database["public"]["Enums"]["household_role"];
          user_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          household_id: string;
          invited_at?: string;
          role?: Database["public"]["Enums"]["household_role"];
          user_id: string;
        };
        Update: {
          accepted_at?: string | null;
          household_id?: string;
          invited_at?: string;
          role?: Database["public"]["Enums"]["household_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      households: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      medication_price_quotes: {
        Row: {
          created_at: string;
          created_by: string | null;
          household_id: string;
          id: string;
          link_url: string | null;
          medication_id: string;
          notes: string | null;
          pack_size_label: string | null;
          pet_id: string;
          price_cents: number;
          recorded_on: string;
          source: Database["public"]["Enums"]["pharmacy_source"];
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          household_id: string;
          id?: string;
          link_url?: string | null;
          medication_id: string;
          notes?: string | null;
          pack_size_label?: string | null;
          pet_id: string;
          price_cents: number;
          recorded_on?: string;
          source: Database["public"]["Enums"]["pharmacy_source"];
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          household_id?: string;
          id?: string;
          link_url?: string | null;
          medication_id?: string;
          notes?: string | null;
          pack_size_label?: string | null;
          pet_id?: string;
          price_cents?: number;
          recorded_on?: string;
          source?: Database["public"]["Enums"]["pharmacy_source"];
        };
        Relationships: [];
      };
      claims: {
        Row: {
          amount_approved_cents: number | null;
          amount_reimbursed_cents: number | null;
          claim_number: string | null;
          created_at: string;
          created_by: string | null;
          decided_on: string | null;
          denial_reason: string | null;
          household_id: string;
          id: string;
          insurance_policy_id: string | null;
          notes: string | null;
          pet_id: string;
          service_date: string | null;
          status: Database["public"]["Enums"]["claim_status"];
          submitted_on: string | null;
          total_billed_cents: number | null;
          updated_at: string;
        };
        Insert: {
          amount_approved_cents?: number | null;
          amount_reimbursed_cents?: number | null;
          claim_number?: string | null;
          created_at?: string;
          created_by?: string | null;
          decided_on?: string | null;
          denial_reason?: string | null;
          household_id: string;
          id?: string;
          insurance_policy_id?: string | null;
          notes?: string | null;
          pet_id: string;
          service_date?: string | null;
          status?: Database["public"]["Enums"]["claim_status"];
          submitted_on?: string | null;
          total_billed_cents?: number | null;
          updated_at?: string;
        };
        Update: {
          amount_approved_cents?: number | null;
          amount_reimbursed_cents?: number | null;
          claim_number?: string | null;
          created_at?: string;
          created_by?: string | null;
          decided_on?: string | null;
          denial_reason?: string | null;
          household_id?: string;
          id?: string;
          insurance_policy_id?: string | null;
          notes?: string | null;
          pet_id?: string;
          service_date?: string | null;
          status?: Database["public"]["Enums"]["claim_status"];
          submitted_on?: string | null;
          total_billed_cents?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      claim_attachments: {
        Row: {
          added_at: string;
          attachment_id: string;
          attachment_type: string;
          claim_id: string;
          household_id: string;
        };
        Insert: {
          added_at?: string;
          attachment_id: string;
          attachment_type: string;
          claim_id: string;
          household_id: string;
        };
        Update: {
          added_at?: string;
          attachment_id?: string;
          attachment_type?: string;
          claim_id?: string;
          household_id?: string;
        };
        Relationships: [];
      };
      lab_values: {
        Row: {
          analyte: string;
          collected_on: string;
          created_at: string;
          created_by: string | null;
          document_id: string | null;
          flag: string | null;
          household_id: string;
          id: string;
          lab: string | null;
          medical_event_id: string | null;
          pet_id: string;
          reference_high: number | null;
          reference_low: number | null;
          units: string | null;
          value: number;
        };
        Insert: {
          analyte: string;
          collected_on: string;
          created_at?: string;
          created_by?: string | null;
          document_id?: string | null;
          flag?: string | null;
          household_id: string;
          id?: string;
          lab?: string | null;
          medical_event_id?: string | null;
          pet_id: string;
          reference_high?: number | null;
          reference_low?: number | null;
          units?: string | null;
          value: number;
        };
        Update: {
          analyte?: string;
          collected_on?: string;
          created_at?: string;
          created_by?: string | null;
          document_id?: string | null;
          flag?: string | null;
          household_id?: string;
          id?: string;
          lab?: string | null;
          medical_event_id?: string | null;
          pet_id?: string;
          reference_high?: number | null;
          reference_low?: number | null;
          units?: string | null;
          value?: number;
        };
        Relationships: [];
      };
      medication_administrations: {
        Row: {
          administered_at: string | null;
          administered_on: string;
          created_at: string;
          created_by: string | null;
          household_id: string;
          id: string;
          medication_id: string;
          notes: string | null;
          pet_id: string;
        };
        Insert: {
          administered_at?: string | null;
          administered_on: string;
          created_at?: string;
          created_by?: string | null;
          household_id: string;
          id?: string;
          medication_id: string;
          notes?: string | null;
          pet_id: string;
        };
        Update: {
          administered_at?: string | null;
          administered_on?: string;
          created_at?: string;
          created_by?: string | null;
          household_id?: string;
          id?: string;
          medication_id?: string;
          notes?: string | null;
          pet_id?: string;
        };
        Relationships: [];
      };
      medical_events: {
        Row: {
          attending_vet: string | null;
          created_at: string;
          created_by: string | null;
          diagnosis: string | null;
          document_id: string | null;
          event_type: Database["public"]["Enums"]["medical_event_type"];
          household_id: string;
          id: string;
          notes: string | null;
          occurred_on: string;
          pet_id: string;
          summary: string | null;
          title: string;
          treatment: string | null;
          updated_at: string;
          vet_clinic_id: string | null;
        };
        Insert: {
          attending_vet?: string | null;
          created_at?: string;
          created_by?: string | null;
          diagnosis?: string | null;
          document_id?: string | null;
          event_type: Database["public"]["Enums"]["medical_event_type"];
          household_id: string;
          id?: string;
          notes?: string | null;
          occurred_on: string;
          pet_id: string;
          summary?: string | null;
          title: string;
          treatment?: string | null;
          updated_at?: string;
          vet_clinic_id?: string | null;
        };
        Update: {
          attending_vet?: string | null;
          created_at?: string;
          created_by?: string | null;
          diagnosis?: string | null;
          document_id?: string | null;
          event_type?: Database["public"]["Enums"]["medical_event_type"];
          household_id?: string;
          id?: string;
          notes?: string | null;
          occurred_on?: string;
          pet_id?: string;
          summary?: string | null;
          title?: string;
          treatment?: string | null;
          updated_at?: string;
          vet_clinic_id?: string | null;
        };
        Relationships: [];
      };
      medications: {
        Row: {
          created_at: string;
          created_by: string | null;
          document_id: string | null;
          dose: string;
          duration_days: number | null;
          ended_on: string | null;
          frequency: string | null;
          generic_name: string | null;
          household_id: string;
          id: string;
          indication: string | null;
          medication_context: Database["public"]["Enums"]["medication_context"];
          name: string;
          notes: string | null;
          pet_id: string;
          prescriber: string | null;
          route: string | null;
          started_on: string;
          updated_at: string;
          vet_clinic_id: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          document_id?: string | null;
          dose: string;
          duration_days?: number | null;
          ended_on?: string | null;
          frequency?: string | null;
          generic_name?: string | null;
          household_id: string;
          id?: string;
          indication?: string | null;
          medication_context?: Database["public"]["Enums"]["medication_context"];
          name: string;
          notes?: string | null;
          pet_id: string;
          prescriber?: string | null;
          route?: string | null;
          started_on: string;
          updated_at?: string;
          vet_clinic_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          document_id?: string | null;
          dose?: string;
          duration_days?: number | null;
          ended_on?: string | null;
          frequency?: string | null;
          generic_name?: string | null;
          household_id?: string;
          id?: string;
          indication?: string | null;
          medication_context?: Database["public"]["Enums"]["medication_context"];
          name?: string;
          notes?: string | null;
          pet_id?: string;
          prescriber?: string | null;
          route?: string | null;
          started_on?: string;
          updated_at?: string;
          vet_clinic_id?: string | null;
        };
        Relationships: [];
      };
      pets: {
        Row: {
          acquired_on: string | null;
          allergies: string | null;
          altered: boolean | null;
          archived_at: string | null;
          breed: string | null;
          color: string | null;
          created_at: string;
          created_by: string | null;
          current_weight_kg: number | null;
          date_of_birth: string | null;
          dob_is_estimated: boolean;
          household_id: string;
          id: string;
          markings: string | null;
          microchip_implanted_on: string | null;
          microchip_number: string | null;
          microchip_registry: string | null;
          name: string;
          notes: string | null;
          photo_storage_path: string | null;
          sex: Database["public"]["Enums"]["pet_sex"];
          species: Database["public"]["Enums"]["pet_species"];
          updated_at: string;
        };
        Insert: {
          acquired_on?: string | null;
          allergies?: string | null;
          altered?: boolean | null;
          archived_at?: string | null;
          breed?: string | null;
          color?: string | null;
          created_at?: string;
          created_by?: string | null;
          current_weight_kg?: number | null;
          date_of_birth?: string | null;
          dob_is_estimated?: boolean;
          household_id: string;
          id?: string;
          markings?: string | null;
          microchip_implanted_on?: string | null;
          microchip_number?: string | null;
          microchip_registry?: string | null;
          name: string;
          notes?: string | null;
          photo_storage_path?: string | null;
          sex?: Database["public"]["Enums"]["pet_sex"];
          species: Database["public"]["Enums"]["pet_species"];
          updated_at?: string;
        };
        Update: {
          acquired_on?: string | null;
          allergies?: string | null;
          altered?: boolean | null;
          archived_at?: string | null;
          breed?: string | null;
          color?: string | null;
          created_at?: string;
          created_by?: string | null;
          current_weight_kg?: number | null;
          date_of_birth?: string | null;
          dob_is_estimated?: boolean;
          household_id?: string;
          id?: string;
          markings?: string | null;
          microchip_implanted_on?: string | null;
          microchip_number?: string | null;
          microchip_registry?: string | null;
          name?: string;
          notes?: string | null;
          photo_storage_path?: string | null;
          sex?: Database["public"]["Enums"]["pet_sex"];
          species?: Database["public"]["Enums"]["pet_species"];
          updated_at?: string;
        };
        Relationships: [];
      };
      reminder_preferences: {
        Row: {
          auto_request_lead_days: number;
          auto_request_records: boolean;
          email_address: string | null;
          email_enabled: boolean;
          household_id: string;
          quiet_hour_end: number | null;
          quiet_hour_start: number | null;
          timezone: string;
          updated_at: string;
          vaccine_lead_days: number[];
        };
        Insert: {
          auto_request_lead_days?: number;
          auto_request_records?: boolean;
          email_address?: string | null;
          email_enabled?: boolean;
          household_id: string;
          quiet_hour_end?: number | null;
          quiet_hour_start?: number | null;
          timezone?: string;
          updated_at?: string;
          vaccine_lead_days?: number[];
        };
        Update: {
          auto_request_lead_days?: number;
          auto_request_records?: boolean;
          email_address?: string | null;
          email_enabled?: boolean;
          household_id?: string;
          quiet_hour_end?: number | null;
          quiet_hour_start?: number | null;
          timezone?: string;
          updated_at?: string;
          vaccine_lead_days?: number[];
        };
        Relationships: [];
      };
      reminders: {
        Row: {
          channel: Database["public"]["Enums"]["reminder_channel"];
          created_at: string;
          due_on: string;
          entity_id: string;
          entity_type: string;
          error_message: string | null;
          household_id: string;
          id: string;
          lead_days: number;
          pet_id: string | null;
          resend_message_id: string | null;
          scheduled_for: string;
          sent_at: string | null;
          snoozed_until: string | null;
          status: Database["public"]["Enums"]["reminder_status"];
          updated_at: string;
        };
        Insert: {
          channel?: Database["public"]["Enums"]["reminder_channel"];
          created_at?: string;
          due_on: string;
          entity_id: string;
          entity_type: string;
          error_message?: string | null;
          household_id: string;
          id?: string;
          lead_days: number;
          pet_id?: string | null;
          resend_message_id?: string | null;
          scheduled_for: string;
          sent_at?: string | null;
          snoozed_until?: string | null;
          status?: Database["public"]["Enums"]["reminder_status"];
          updated_at?: string;
        };
        Update: {
          channel?: Database["public"]["Enums"]["reminder_channel"];
          created_at?: string;
          due_on?: string;
          entity_id?: string;
          entity_type?: string;
          error_message?: string | null;
          household_id?: string;
          id?: string;
          lead_days?: number;
          pet_id?: string | null;
          resend_message_id?: string | null;
          scheduled_for?: string;
          sent_at?: string | null;
          snoozed_until?: string | null;
          status?: Database["public"]["Enums"]["reminder_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      vaccinations: {
        Row: {
          administered_on: string;
          administering_vet: string | null;
          created_at: string;
          created_by: string | null;
          document_id: string | null;
          expires_on: string | null;
          household_id: string;
          id: string;
          is_rabies: boolean | null;
          lot_number: string | null;
          manufacturer: string | null;
          notes: string | null;
          pet_id: string;
          reminder_lead_days: number[];
          updated_at: string;
          vaccine_family: string | null;
          vaccine_type: string;
          vet_clinic_id: string | null;
        };
        Insert: {
          administered_on: string;
          administering_vet?: string | null;
          created_at?: string;
          created_by?: string | null;
          document_id?: string | null;
          expires_on?: string | null;
          household_id: string;
          id?: string;
          is_rabies?: boolean | null;
          lot_number?: string | null;
          manufacturer?: string | null;
          notes?: string | null;
          pet_id: string;
          reminder_lead_days?: number[];
          updated_at?: string;
          // vaccine_family is GENERATED ALWAYS (vaccine_family_of(vaccine_type))
          // — deliberately absent from Insert/Update; Postgres rejects writes.
          vaccine_type: string;
          vet_clinic_id?: string | null;
        };
        Update: {
          administered_on?: string;
          administering_vet?: string | null;
          created_at?: string;
          created_by?: string | null;
          document_id?: string | null;
          expires_on?: string | null;
          household_id?: string;
          id?: string;
          is_rabies?: boolean | null;
          lot_number?: string | null;
          manufacturer?: string | null;
          notes?: string | null;
          pet_id?: string;
          reminder_lead_days?: number[];
          updated_at?: string;
          vaccine_type?: string;
          vet_clinic_id?: string | null;
        };
        Relationships: [];
      };
      vet_clinics: {
        Row: {
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          country: string | null;
          created_at: string;
          email: string | null;
          household_id: string;
          id: string;
          last_seen_at: string | null;
          name: string;
          notes: string | null;
          phone: string | null;
          phone_normalized: string | null;
          postal_code: string | null;
          region: string | null;
          updated_at: string;
          verified_at: string | null;
          verified_source: string | null;
          website: string | null;
        };
        Insert: {
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          email?: string | null;
          household_id: string;
          id?: string;
          last_seen_at?: string | null;
          name: string;
          notes?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          region?: string | null;
          updated_at?: string;
          verified_at?: string | null;
          verified_source?: string | null;
          website?: string | null;
        };
        Update: {
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          email?: string | null;
          household_id?: string;
          id?: string;
          last_seen_at?: string | null;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          region?: string | null;
          updated_at?: string;
          verified_at?: string | null;
          verified_source?: string | null;
          website?: string | null;
        };
        Relationships: [];
      };
      weight_log: {
        Row: {
          created_at: string;
          created_by: string | null;
          document_id: string | null;
          household_id: string;
          id: string;
          notes: string | null;
          pet_id: string;
          recorded_on: string;
          source: Database["public"]["Enums"]["weight_source"];
          weight_kg: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          document_id?: string | null;
          household_id: string;
          id?: string;
          notes?: string | null;
          pet_id: string;
          recorded_on: string;
          source?: Database["public"]["Enums"]["weight_source"];
          weight_kg: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          document_id?: string | null;
          household_id?: string;
          id?: string;
          notes?: string | null;
          pet_id?: string;
          recorded_on?: string;
          source?: Database["public"]["Enums"]["weight_source"];
          weight_kg?: number;
        };
        Relationships: [];
      };
      authorizations: {
        Row: {
          authorization_type: Database["public"]["Enums"]["authorization_type"];
          granted_at: string;
          granted_by: string | null;
          household_id: string;
          id: string;
          ip_address: string | null;
          revoked_at: string | null;
          revoked_by: string | null;
          scope_text: string;
          user_agent: string | null;
        };
        Insert: {
          authorization_type: Database["public"]["Enums"]["authorization_type"];
          granted_at?: string;
          granted_by?: string | null;
          household_id: string;
          id?: string;
          ip_address?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          scope_text: string;
          user_agent?: string | null;
        };
        Update: {
          authorization_type?: Database["public"]["Enums"]["authorization_type"];
          granted_at?: string;
          granted_by?: string | null;
          household_id?: string;
          id?: string;
          ip_address?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          scope_text?: string;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      outbound_emails: {
        Row: {
          authorization_id: string;
          body_html: string | null;
          body_text: string;
          created_at: string;
          created_by: string | null;
          error_message: string | null;
          household_id: string;
          id: string;
          pet_id: string | null;
          recipient_email: string;
          recipient_name: string | null;
          recipient_type: Database["public"]["Enums"]["outbound_recipient_type"];
          reply_received_at: string | null;
          reply_thread_id: string | null;
          resend_message_id: string | null;
          sent_at: string | null;
          status: Database["public"]["Enums"]["outbound_email_status"];
          subject: string;
          template_id: string | null;
        };
        Insert: {
          authorization_id: string;
          body_html?: string | null;
          body_text: string;
          created_at?: string;
          created_by?: string | null;
          error_message?: string | null;
          household_id: string;
          id?: string;
          pet_id?: string | null;
          recipient_email: string;
          recipient_name?: string | null;
          recipient_type: Database["public"]["Enums"]["outbound_recipient_type"];
          reply_received_at?: string | null;
          reply_thread_id?: string | null;
          resend_message_id?: string | null;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["outbound_email_status"];
          subject: string;
          template_id?: string | null;
        };
        Update: {
          authorization_id?: string;
          body_html?: string | null;
          body_text?: string;
          created_at?: string;
          created_by?: string | null;
          error_message?: string | null;
          household_id?: string;
          id?: string;
          pet_id?: string | null;
          recipient_email?: string;
          recipient_name?: string | null;
          recipient_type?: Database["public"]["Enums"]["outbound_recipient_type"];
          reply_received_at?: string | null;
          reply_thread_id?: string | null;
          resend_message_id?: string | null;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["outbound_email_status"];
          subject?: string;
          template_id?: string | null;
        };
        Relationships: [];
      };
      insurance_policies: {
        Row: {
          annual_max_cents: number | null;
          archived_at: string | null;
          created_at: string;
          created_by: string | null;
          deductible_annual_cents: number | null;
          document_id: string | null;
          effective_on: string | null;
          extracted_exclusions: string[] | null;
          extracted_pec_definitions: Json | null;
          household_id: string;
          id: string;
          insurer_name: string;
          notes: string | null;
          pet_id: string | null;
          plan_name: string | null;
          policy_number: string | null;
          premium_monthly_cents: number | null;
          raw_extraction: Json | null;
          reimbursement_rate: number | null;
          renews_on: string | null;
          updated_at: string;
        };
        Insert: {
          annual_max_cents?: number | null;
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          deductible_annual_cents?: number | null;
          document_id?: string | null;
          effective_on?: string | null;
          extracted_exclusions?: string[] | null;
          extracted_pec_definitions?: Json | null;
          household_id: string;
          id?: string;
          insurer_name: string;
          notes?: string | null;
          pet_id?: string | null;
          plan_name?: string | null;
          policy_number?: string | null;
          premium_monthly_cents?: number | null;
          raw_extraction?: Json | null;
          reimbursement_rate?: number | null;
          renews_on?: string | null;
          updated_at?: string;
        };
        Update: {
          annual_max_cents?: number | null;
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          deductible_annual_cents?: number | null;
          document_id?: string | null;
          effective_on?: string | null;
          extracted_exclusions?: string[] | null;
          extracted_pec_definitions?: Json | null;
          household_id?: string;
          id?: string;
          insurer_name?: string;
          notes?: string | null;
          pet_id?: string | null;
          plan_name?: string | null;
          policy_number?: string | null;
          premium_monthly_cents?: number | null;
          raw_extraction?: Json | null;
          reimbursement_rate?: number | null;
          renews_on?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      cost_estimates: {
        Row: {
          applied_deductible_cents: number | null;
          computed_at: string | null;
          computed_by_model: string | null;
          created_at: string;
          created_by: string | null;
          gross_estimate_cents: number | null;
          household_id: string;
          id: string;
          insurance_policy_id: string | null;
          notes: string | null;
          pet_id: string;
          procedure_summary: string;
          reimbursement_eligible_cents: number | null;
          reimbursement_rate: number | null;
          request_email_id: string | null;
          response_document_id: string | null;
          status: Database["public"]["Enums"]["cost_estimate_status"];
          true_oop_cents: number | null;
          updated_at: string;
        };
        Insert: {
          applied_deductible_cents?: number | null;
          computed_at?: string | null;
          computed_by_model?: string | null;
          created_at?: string;
          created_by?: string | null;
          gross_estimate_cents?: number | null;
          household_id: string;
          id?: string;
          insurance_policy_id?: string | null;
          notes?: string | null;
          pet_id: string;
          procedure_summary: string;
          reimbursement_eligible_cents?: number | null;
          reimbursement_rate?: number | null;
          request_email_id?: string | null;
          response_document_id?: string | null;
          status?: Database["public"]["Enums"]["cost_estimate_status"];
          true_oop_cents?: number | null;
          updated_at?: string;
        };
        Update: {
          applied_deductible_cents?: number | null;
          computed_at?: string | null;
          computed_by_model?: string | null;
          created_at?: string;
          created_by?: string | null;
          gross_estimate_cents?: number | null;
          household_id?: string;
          id?: string;
          insurance_policy_id?: string | null;
          notes?: string | null;
          pet_id?: string;
          procedure_summary?: string;
          reimbursement_eligible_cents?: number | null;
          reimbursement_rate?: number | null;
          request_email_id?: string | null;
          response_document_id?: string | null;
          status?: Database["public"]["Enums"]["cost_estimate_status"];
          true_oop_cents?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      extraction_chunks: {
        Row: {
          content: string;
          created_at: string;
          document_id: string;
          embedding: string | null;
          extraction_id: string | null;
          household_id: string;
          id: string;
          pet_id: string | null;
          source_path: string | null;
        };
        Insert: {
          content: string;
          created_at?: string;
          document_id: string;
          embedding?: string | null;
          extraction_id?: string | null;
          household_id: string;
          id?: string;
          pet_id?: string | null;
          source_path?: string | null;
        };
        Update: {
          content?: string;
          created_at?: string;
          document_id?: string;
          embedding?: string | null;
          extraction_id?: string | null;
          household_id?: string;
          id?: string;
          pet_id?: string | null;
          source_path?: string | null;
        };
        Relationships: [];
      };
      pending_records_requests: {
        Row: {
          created_at: string;
          created_by: string | null;
          error_message: string | null;
          household_id: string;
          id: string;
          medical_event_id: string | null;
          outbound_email_id: string | null;
          pet_id: string;
          request_summary: string;
          scheduled_for: string;
          status: Database["public"]["Enums"]["pending_request_status"];
          vet_clinic_id: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          error_message?: string | null;
          household_id: string;
          id?: string;
          medical_event_id?: string | null;
          outbound_email_id?: string | null;
          pet_id: string;
          request_summary: string;
          scheduled_for: string;
          status?: Database["public"]["Enums"]["pending_request_status"];
          vet_clinic_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          error_message?: string | null;
          household_id?: string;
          id?: string;
          medical_event_id?: string | null;
          outbound_email_id?: string | null;
          pet_id?: string;
          request_summary?: string;
          scheduled_for?: string;
          status?: Database["public"]["Enums"]["pending_request_status"];
          vet_clinic_id?: string | null;
        };
        Relationships: [];
      };
      share_links: {
        Row: {
          access_count: number;
          created_at: string;
          created_by: string | null;
          expires_at: string;
          household_id: string;
          id: string;
          last_accessed_at: string | null;
          pet_id: string;
          recipient_label: string | null;
          revoked_at: string | null;
          scope: Database["public"]["Enums"]["share_scope"];
          token_hash: string;
        };
        Insert: {
          access_count?: number;
          created_at?: string;
          created_by?: string | null;
          expires_at: string;
          household_id: string;
          id?: string;
          last_accessed_at?: string | null;
          pet_id: string;
          recipient_label?: string | null;
          revoked_at?: string | null;
          scope?: Database["public"]["Enums"]["share_scope"];
          token_hash: string;
        };
        Update: {
          access_count?: number;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string;
          household_id?: string;
          id?: string;
          last_accessed_at?: string | null;
          pet_id?: string;
          recipient_label?: string | null;
          revoked_at?: string | null;
          scope?: Database["public"]["Enums"]["share_scope"];
          token_hash?: string;
        };
        Relationships: [];
      };
      qol_entries: {
        Row: {
          created_at: string;
          created_by: string | null;
          happiness: number;
          household_id: string;
          hunger: number;
          hurt: number;
          hydration: number;
          hygiene: number;
          id: string;
          mobility: number;
          more_good: number;
          notes: string | null;
          pet_id: string;
          recorded_on: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          happiness: number;
          household_id: string;
          hunger: number;
          hurt: number;
          hydration: number;
          hygiene: number;
          id?: string;
          mobility: number;
          more_good: number;
          notes?: string | null;
          pet_id: string;
          recorded_on: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          happiness?: number;
          household_id?: string;
          hunger?: number;
          hurt?: number;
          hydration?: number;
          hygiene?: number;
          id?: string;
          mobility?: number;
          more_good?: number;
          notes?: string | null;
          pet_id?: string;
          recorded_on?: string;
        };
        Relationships: [];
      };
      household_inbound_addresses: {
        Row: {
          created_at: string;
          household_id: string;
          id: string;
          slug: string;
        };
        Insert: {
          created_at?: string;
          household_id: string;
          id?: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          household_id?: string;
          id?: string;
          slug?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      has_household_write: { Args: { p_household: string }; Returns: boolean };
      is_household_member: { Args: { p_household: string }; Returns: boolean };
      match_extraction_chunks: {
        Args: {
          query_embedding: string;
          match_count: number;
          p_household_id: string;
        };
        Returns: {
          id: string;
          document_id: string;
          pet_id: string | null;
          source_path: string | null;
          content: string;
          similarity: number;
        }[];
      };
    };
    Enums: {
      audit_action:
        | "create"
        | "update"
        | "delete"
        | "archive"
        | "commit_extraction"
        | "discard_extraction"
        | "invite_member"
        | "revoke_member"
        | "accept_invitation"
        | "login"
        | "preferences_change";
      authorization_type:
        | "records_request_to_vets"
        | "records_distribution_to_third_parties"
        | "insurer_clarification_emails"
        | "affiliate_disclosure_acknowledged";
      claim_status:
        | "drafted"
        | "submitted"
        | "approved"
        | "partially_approved"
        | "denied"
        | "appealed"
        | "closed";
      cost_estimate_status:
        | "pending_vet_response"
        | "computed"
        | "expired"
        | "cancelled";
      document_type:
        | "vaccine_certificate"
        | "vet_visit_summary"
        | "lab_result"
        | "invoice"
        | "prescription"
        | "imaging"
        | "adoption_record"
        | "microchip_record"
        | "other"
        | "unknown";
      extraction_status: "pending_review" | "committed" | "discarded";
      extraction_feedback_rating:
        | "great"
        | "mostly_good"
        | "many_errors"
        | "unreadable"
        | "wrong_doctype";
      household_role: "owner" | "member" | "viewer";
      medical_event_type:
        | "exam"
        | "illness"
        | "injury"
        | "surgery"
        | "dental"
        | "lab_result"
        | "imaging"
        | "parasite_prevention"
        | "behavioral"
        | "other";
      medication_context:
        | "prescribed_takehome"
        | "intraoperative"
        | "injection_in_office"
        | "otc_recommended"
        | "unknown";
      outbound_email_status:
        | "drafted"
        | "queued"
        | "sent"
        | "bounced"
        | "failed"
        | "replied";
      outbound_recipient_type:
        | "vet_clinic"
        | "insurer"
        | "boarding_facility"
        | "specialist"
        | "pharmacy"
        | "other";
      pending_request_status: "scheduled" | "sent" | "cancelled" | "failed";
      pet_sex: "male" | "female" | "unknown";
      pharmacy_source:
        | "chewy"
        | "costco"
        | "goodrx"
        | "1800petmeds"
        | "walmart"
        | "vet_in_house"
        | "other";
      pet_species: "dog" | "cat" | "other";
      processing_status:
        | "pending"
        | "extracting"
        | "extracted"
        | "confirmed"
        | "failed";
      reminder_channel: "email" | "push" | "sms";
      reminder_status: "scheduled" | "sent" | "failed" | "skipped";
      share_scope: "boarding_packet";
      weight_source: "manual" | "extracted" | "vet_visit";
    };
    CompositeTypes: Record<string, never>;
  };
};
