// Generated from Supabase project ozexfuawzqjcjgdhgrqx via:
//   pnpm dlx supabase gen types typescript --project-id <ref>
// Or via the MCP tool generate_typescript_types. Regenerate after schema changes.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      animal_transfers: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          accepted_household_id: string | null
          animal_id: string
          created_at: string
          created_by: string | null
          declined_at: string | null
          expires_at: string
          from_household_id: string
          id: string
          message: string | null
          recipient_email: string | null
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          accepted_household_id?: string | null
          animal_id: string
          created_at?: string
          created_by?: string | null
          declined_at?: string | null
          expires_at?: string
          from_household_id: string
          id?: string
          message?: string | null
          recipient_email?: string | null
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          accepted_household_id?: string | null
          animal_id?: string
          created_at?: string
          created_by?: string | null
          declined_at?: string | null
          expires_at?: string
          from_household_id?: string
          id?: string
          message?: string | null
          recipient_email?: string | null
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "animal_transfers_accepted_household_id_fkey"
            columns: ["accepted_household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animal_transfers_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animal_transfers_from_household_id_fkey"
            columns: ["from_household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      animals: {
        Row: {
          acquired_on: string | null
          allergies: string | null
          altered: boolean | null
          archived_at: string | null
          breed: string | null
          color: string | null
          created_at: string
          created_by: string | null
          current_weight_kg: number | null
          dam_id: string | null
          date_of_birth: string | null
          dob_is_estimated: boolean
          id: string
          litter_id: string | null
          markings: string | null
          microchip_implanted_on: string | null
          microchip_number: string | null
          microchip_registry: string | null
          name: string
          notes: string | null
          photo_storage_path: string | null
          placement_status: Database["public"]["Enums"]["animal_placement_status"]
          sex: Database["public"]["Enums"]["pet_sex"]
          sire_id: string | null
          species: Database["public"]["Enums"]["pet_species"]
          updated_at: string
        }
        Insert: {
          acquired_on?: string | null
          allergies?: string | null
          altered?: boolean | null
          archived_at?: string | null
          breed?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          current_weight_kg?: number | null
          dam_id?: string | null
          date_of_birth?: string | null
          dob_is_estimated?: boolean
          id?: string
          litter_id?: string | null
          markings?: string | null
          microchip_implanted_on?: string | null
          microchip_number?: string | null
          microchip_registry?: string | null
          name: string
          notes?: string | null
          photo_storage_path?: string | null
          placement_status?: Database["public"]["Enums"]["animal_placement_status"]
          sex?: Database["public"]["Enums"]["pet_sex"]
          sire_id?: string | null
          species: Database["public"]["Enums"]["pet_species"]
          updated_at?: string
        }
        Update: {
          acquired_on?: string | null
          allergies?: string | null
          altered?: boolean | null
          archived_at?: string | null
          breed?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          current_weight_kg?: number | null
          dam_id?: string | null
          date_of_birth?: string | null
          dob_is_estimated?: boolean
          id?: string
          litter_id?: string | null
          markings?: string | null
          microchip_implanted_on?: string | null
          microchip_number?: string | null
          microchip_registry?: string | null
          name?: string
          notes?: string | null
          photo_storage_path?: string | null
          placement_status?: Database["public"]["Enums"]["animal_placement_status"]
          sex?: Database["public"]["Enums"]["pet_sex"]
          sire_id?: string | null
          species?: Database["public"]["Enums"]["pet_species"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "animals_dam_id_fkey"
            columns: ["dam_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_sire_id_fkey"
            columns: ["sire_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_animals_litter"
            columns: ["litter_id"]
            isOneToOne: false
            referencedRelation: "litters"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id: string | null
          created_at: string
          diff: Json
          entity_id: string | null
          entity_type: string
          household_id: string
          id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          created_at?: string
          diff?: Json
          entity_id?: string | null
          entity_type: string
          household_id: string
          id?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          created_at?: string
          diff?: Json
          entity_id?: string | null
          entity_type?: string
          household_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      authorizations: {
        Row: {
          authorization_type: Database["public"]["Enums"]["authorization_type"]
          granted_at: string
          granted_by: string | null
          household_id: string
          id: string
          ip_address: string | null
          revoked_at: string | null
          revoked_by: string | null
          scope_text: string
          user_agent: string | null
        }
        Insert: {
          authorization_type: Database["public"]["Enums"]["authorization_type"]
          granted_at?: string
          granted_by?: string | null
          household_id: string
          id?: string
          ip_address?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          scope_text: string
          user_agent?: string | null
        }
        Update: {
          authorization_type?: Database["public"]["Enums"]["authorization_type"]
          granted_at?: string
          granted_by?: string | null
          household_id?: string
          id?: string
          ip_address?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          scope_text?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "authorizations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_customers: {
        Row: {
          created_at: string
          household_id: string
          stripe_customer_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          stripe_customer_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          stripe_customer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_customers_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: true
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_attachments: {
        Row: {
          added_at: string
          attachment_id: string
          attachment_type: string
          claim_id: string
          household_id: string
        }
        Insert: {
          added_at?: string
          attachment_id: string
          attachment_type: string
          claim_id: string
          household_id: string
        }
        Update: {
          added_at?: string
          attachment_id?: string
          attachment_type?: string
          claim_id?: string
          household_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_attachments_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_attachments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          amount_approved_cents: number | null
          amount_reimbursed_cents: number | null
          claim_number: string | null
          created_at: string
          created_by: string | null
          decided_on: string | null
          denial_reason: string | null
          household_id: string
          id: string
          insurance_policy_id: string | null
          notes: string | null
          pet_id: string
          service_date: string | null
          status: Database["public"]["Enums"]["claim_status"]
          submitted_on: string | null
          total_billed_cents: number | null
          updated_at: string
        }
        Insert: {
          amount_approved_cents?: number | null
          amount_reimbursed_cents?: number | null
          claim_number?: string | null
          created_at?: string
          created_by?: string | null
          decided_on?: string | null
          denial_reason?: string | null
          household_id: string
          id?: string
          insurance_policy_id?: string | null
          notes?: string | null
          pet_id: string
          service_date?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          submitted_on?: string | null
          total_billed_cents?: number | null
          updated_at?: string
        }
        Update: {
          amount_approved_cents?: number | null
          amount_reimbursed_cents?: number | null
          claim_number?: string | null
          created_at?: string
          created_by?: string | null
          decided_on?: string | null
          denial_reason?: string | null
          household_id?: string
          id?: string
          insurance_policy_id?: string | null
          notes?: string | null
          pet_id?: string
          service_date?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          submitted_on?: string | null
          total_billed_cents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_insurance_policy_id_fkey"
            columns: ["insurance_policy_id"]
            isOneToOne: false
            referencedRelation: "insurance_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_estimates: {
        Row: {
          applied_deductible_cents: number | null
          computed_at: string | null
          computed_by_model: string | null
          created_at: string
          created_by: string | null
          gross_estimate_cents: number | null
          household_id: string
          id: string
          insurance_policy_id: string | null
          notes: string | null
          pet_id: string
          procedure_summary: string
          reimbursement_eligible_cents: number | null
          reimbursement_rate: number | null
          request_email_id: string | null
          response_document_id: string | null
          status: Database["public"]["Enums"]["cost_estimate_status"]
          true_oop_cents: number | null
          updated_at: string
        }
        Insert: {
          applied_deductible_cents?: number | null
          computed_at?: string | null
          computed_by_model?: string | null
          created_at?: string
          created_by?: string | null
          gross_estimate_cents?: number | null
          household_id: string
          id?: string
          insurance_policy_id?: string | null
          notes?: string | null
          pet_id: string
          procedure_summary: string
          reimbursement_eligible_cents?: number | null
          reimbursement_rate?: number | null
          request_email_id?: string | null
          response_document_id?: string | null
          status?: Database["public"]["Enums"]["cost_estimate_status"]
          true_oop_cents?: number | null
          updated_at?: string
        }
        Update: {
          applied_deductible_cents?: number | null
          computed_at?: string | null
          computed_by_model?: string | null
          created_at?: string
          created_by?: string | null
          gross_estimate_cents?: number | null
          household_id?: string
          id?: string
          insurance_policy_id?: string | null
          notes?: string | null
          pet_id?: string
          procedure_summary?: string
          reimbursement_eligible_cents?: number | null
          reimbursement_rate?: number | null
          request_email_id?: string | null
          response_document_id?: string | null
          status?: Database["public"]["Enums"]["cost_estimate_status"]
          true_oop_cents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_estimates_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_estimates_insurance_policy_id_fkey"
            columns: ["insurance_policy_id"]
            isOneToOne: false
            referencedRelation: "insurance_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_estimates_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_estimates_request_email_id_fkey"
            columns: ["request_email_id"]
            isOneToOne: false
            referencedRelation: "outbound_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_estimates_response_document_id_fkey"
            columns: ["response_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      custodianships: {
        Row: {
          animal_id: string
          created_at: string
          created_by: string | null
          ended_at: string | null
          household_id: string
          id: string
          role: Database["public"]["Enums"]["custodianship_role"]
          started_at: string
        }
        Insert: {
          animal_id: string
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          household_id: string
          id?: string
          role: Database["public"]["Enums"]["custodianship_role"]
          started_at?: string
        }
        Update: {
          animal_id?: string
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          household_id?: string
          id?: string
          role?: Database["public"]["Enums"]["custodianship_role"]
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custodianships_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custodianships_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      dataset_release_items: {
        Row: {
          created_at: string
          id: string
          release_id: string
          row_hash: string | null
          source_row_id: string
          source_table: string
        }
        Insert: {
          created_at?: string
          id?: string
          release_id: string
          row_hash?: string | null
          source_row_id: string
          source_table: string
        }
        Update: {
          created_at?: string
          id?: string
          release_id?: string
          row_hash?: string | null
          source_row_id?: string
          source_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "dataset_release_items_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "dataset_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      dataset_releases: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          recipient: string | null
          released_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          recipient?: string | null
          released_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          recipient?: string | null
          released_at?: string | null
        }
        Relationships: []
      }
      document_extractions: {
        Row: {
          committed_at: string | null
          committed_by: string | null
          confidence_overall: number | null
          document_id: string
          extracted_at: string
          household_id: string
          id: string
          model: string
          model_version: string | null
          prompt_version: string
          raw_response: Json
          status: Database["public"]["Enums"]["extraction_status"]
        }
        Insert: {
          committed_at?: string | null
          committed_by?: string | null
          confidence_overall?: number | null
          document_id: string
          extracted_at?: string
          household_id: string
          id?: string
          model: string
          model_version?: string | null
          prompt_version: string
          raw_response: Json
          status?: Database["public"]["Enums"]["extraction_status"]
        }
        Update: {
          committed_at?: string | null
          committed_by?: string | null
          confidence_overall?: number | null
          document_id?: string
          extracted_at?: string
          household_id?: string
          id?: string
          model?: string
          model_version?: string | null
          prompt_version?: string
          raw_response?: Json
          status?: Database["public"]["Enums"]["extraction_status"]
        }
        Relationships: [
          {
            foreignKeyName: "document_extractions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_extractions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      document_pet_links: {
        Row: {
          document_id: string
          household_id: string
          pet_id: string
        }
        Insert: {
          document_id: string
          household_id: string
          pet_id: string
        }
        Update: {
          document_id?: string
          household_id?: string
          pet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_pet_links_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_pet_links_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_pet_links_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          byte_size: number | null
          confirmed_at: string | null
          content_hash: string | null
          created_by: string | null
          doc_type: Database["public"]["Enums"]["document_type"]
          error_message: string | null
          extraction_attempts: number
          household_id: string
          id: string
          mime_type: string | null
          original_filename: string | null
          pet_id: string | null
          processed_at: string | null
          processing_status: Database["public"]["Enums"]["processing_status"]
          storage_bucket: string
          storage_path: string
          updated_at: string
          uploaded_at: string
        }
        Insert: {
          byte_size?: number | null
          confirmed_at?: string | null
          content_hash?: string | null
          created_by?: string | null
          doc_type?: Database["public"]["Enums"]["document_type"]
          error_message?: string | null
          extraction_attempts?: number
          household_id: string
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          pet_id?: string | null
          processed_at?: string | null
          processing_status?: Database["public"]["Enums"]["processing_status"]
          storage_bucket?: string
          storage_path: string
          updated_at?: string
          uploaded_at?: string
        }
        Update: {
          byte_size?: number | null
          confirmed_at?: string | null
          content_hash?: string | null
          created_by?: string | null
          doc_type?: Database["public"]["Enums"]["document_type"]
          error_message?: string | null
          extraction_attempts?: number
          household_id?: string
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          pet_id?: string | null
          processed_at?: string | null
          processing_status?: Database["public"]["Enums"]["processing_status"]
          storage_bucket?: string
          storage_path?: string
          updated_at?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      extraction_chunks: {
        Row: {
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          extraction_id: string | null
          household_id: string
          id: string
          pet_id: string | null
          source_path: string | null
        }
        Insert: {
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          extraction_id?: string | null
          household_id: string
          id?: string
          pet_id?: string | null
          source_path?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          extraction_id?: string | null
          household_id?: string
          id?: string
          pet_id?: string | null
          source_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extraction_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_chunks_extraction_id_fkey"
            columns: ["extraction_id"]
            isOneToOne: false
            referencedRelation: "document_extractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_chunks_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_chunks_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      extraction_feedback: {
        Row: {
          created_at: string
          created_by: string | null
          document_id: string
          extraction_id: string
          extraction_model: string
          extraction_prompt_version: string
          household_id: string
          id: string
          issue_notes: string | null
          issue_tags: string[]
          rating: Database["public"]["Enums"]["extraction_feedback_rating"]
          value_diff: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_id: string
          extraction_id: string
          extraction_model: string
          extraction_prompt_version: string
          household_id: string
          id?: string
          issue_notes?: string | null
          issue_tags?: string[]
          rating: Database["public"]["Enums"]["extraction_feedback_rating"]
          value_diff?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_id?: string
          extraction_id?: string
          extraction_model?: string
          extraction_prompt_version?: string
          household_id?: string
          id?: string
          issue_notes?: string | null
          issue_tags?: string[]
          rating?: Database["public"]["Enums"]["extraction_feedback_rating"]
          value_diff?: Json
        }
        Relationships: [
          {
            foreignKeyName: "extraction_feedback_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_feedback_extraction_id_fkey"
            columns: ["extraction_id"]
            isOneToOne: false
            referencedRelation: "document_extractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_feedback_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_inbound_addresses: {
        Row: {
          created_at: string
          household_id: string
          id: string
          slug: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          slug: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_inbound_addresses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          household_id: string
          id: string
          invited_by: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["household_role"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at: string
          household_id: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["household_role"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          household_id?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["household_role"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_invitations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          accepted_at: string | null
          household_id: string
          invited_at: string
          role: Database["public"]["Enums"]["household_role"]
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          household_id: string
          invited_at?: string
          role?: Database["public"]["Enums"]["household_role"]
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          household_id?: string
          invited_at?: string
          role?: Database["public"]["Enums"]["household_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["household_kind"]
          name: string
          plan: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["household_kind"]
          name: string
          plan?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["household_kind"]
          name?: string
          plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      insurance_policies: {
        Row: {
          annual_max_cents: number | null
          archived_at: string | null
          created_at: string
          created_by: string | null
          deductible_annual_cents: number | null
          document_id: string | null
          effective_on: string | null
          extracted_exclusions: string[] | null
          extracted_pec_definitions: Json | null
          household_id: string
          id: string
          insurer_name: string
          notes: string | null
          pet_id: string | null
          plan_name: string | null
          policy_number: string | null
          premium_monthly_cents: number | null
          raw_extraction: Json | null
          reimbursement_rate: number | null
          renews_on: string | null
          updated_at: string
        }
        Insert: {
          annual_max_cents?: number | null
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          deductible_annual_cents?: number | null
          document_id?: string | null
          effective_on?: string | null
          extracted_exclusions?: string[] | null
          extracted_pec_definitions?: Json | null
          household_id: string
          id?: string
          insurer_name: string
          notes?: string | null
          pet_id?: string | null
          plan_name?: string | null
          policy_number?: string | null
          premium_monthly_cents?: number | null
          raw_extraction?: Json | null
          reimbursement_rate?: number | null
          renews_on?: string | null
          updated_at?: string
        }
        Update: {
          annual_max_cents?: number | null
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          deductible_annual_cents?: number | null
          document_id?: string | null
          effective_on?: string | null
          extracted_exclusions?: string[] | null
          extracted_pec_definitions?: Json | null
          household_id?: string
          id?: string
          insurer_name?: string
          notes?: string | null
          pet_id?: string | null
          plan_name?: string | null
          policy_number?: string | null
          premium_monthly_cents?: number | null
          raw_extraction?: Json | null
          reimbursement_rate?: number | null
          renews_on?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_policies_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_policies_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_policies_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount_cents: number
          category: string
          created_at: string
          created_by: string | null
          description: string
          document_id: string | null
          household_id: string
          id: string
          incurred_on: string | null
          medical_event_id: string | null
          pet_id: string | null
        }
        Insert: {
          amount_cents: number
          category?: string
          created_at?: string
          created_by?: string | null
          description: string
          document_id?: string | null
          household_id: string
          id?: string
          incurred_on?: string | null
          medical_event_id?: string | null
          pet_id?: string | null
        }
        Update: {
          amount_cents?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          document_id?: string | null
          household_id?: string
          id?: string
          incurred_on?: string | null
          medical_event_id?: string | null
          pet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_medical_event_id_fkey"
            columns: ["medical_event_id"]
            isOneToOne: false
            referencedRelation: "medical_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_values: {
        Row: {
          analyte: string
          collected_on: string
          created_at: string
          created_by: string | null
          document_id: string | null
          flag: string | null
          household_id: string
          id: string
          lab: string | null
          medical_event_id: string | null
          pet_id: string
          reference_high: number | null
          reference_low: number | null
          units: string | null
          value: number
        }
        Insert: {
          analyte: string
          collected_on: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          flag?: string | null
          household_id: string
          id?: string
          lab?: string | null
          medical_event_id?: string | null
          pet_id: string
          reference_high?: number | null
          reference_low?: number | null
          units?: string | null
          value: number
        }
        Update: {
          analyte?: string
          collected_on?: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          flag?: string | null
          household_id?: string
          id?: string
          lab?: string | null
          medical_event_id?: string | null
          pet_id?: string
          reference_high?: number | null
          reference_low?: number | null
          units?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "lab_values_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_values_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_values_medical_event_id_fkey"
            columns: ["medical_event_id"]
            isOneToOne: false
            referencedRelation: "medical_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_values_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      litters: {
        Row: {
          created_at: string
          dam_animal_id: string
          household_id: string
          id: string
          name: string
          notes: string | null
          sire_animal_id: string | null
          updated_at: string
          whelped_on: string | null
        }
        Insert: {
          created_at?: string
          dam_animal_id: string
          household_id: string
          id?: string
          name: string
          notes?: string | null
          sire_animal_id?: string | null
          updated_at?: string
          whelped_on?: string | null
        }
        Update: {
          created_at?: string
          dam_animal_id?: string
          household_id?: string
          id?: string
          name?: string
          notes?: string | null
          sire_animal_id?: string | null
          updated_at?: string
          whelped_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "litters_dam_animal_id_fkey"
            columns: ["dam_animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "litters_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "litters_sire_animal_id_fkey"
            columns: ["sire_animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_events: {
        Row: {
          attending_vet: string | null
          created_at: string
          created_by: string | null
          diagnosis: string | null
          document_id: string | null
          event_type: Database["public"]["Enums"]["medical_event_type"]
          household_id: string
          id: string
          notes: string | null
          occurred_on: string
          pet_id: string
          summary: string | null
          title: string
          treatment: string | null
          updated_at: string
          vet_clinic_id: string | null
        }
        Insert: {
          attending_vet?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          document_id?: string | null
          event_type: Database["public"]["Enums"]["medical_event_type"]
          household_id: string
          id?: string
          notes?: string | null
          occurred_on: string
          pet_id: string
          summary?: string | null
          title: string
          treatment?: string | null
          updated_at?: string
          vet_clinic_id?: string | null
        }
        Update: {
          attending_vet?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          document_id?: string | null
          event_type?: Database["public"]["Enums"]["medical_event_type"]
          household_id?: string
          id?: string
          notes?: string | null
          occurred_on?: string
          pet_id?: string
          summary?: string | null
          title?: string
          treatment?: string | null
          updated_at?: string
          vet_clinic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_events_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_events_vet_clinic_id_fkey"
            columns: ["vet_clinic_id"]
            isOneToOne: false
            referencedRelation: "vet_clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_administrations: {
        Row: {
          administered_at: string | null
          administered_on: string
          created_at: string
          created_by: string | null
          household_id: string
          id: string
          medication_id: string
          notes: string | null
          pet_id: string
        }
        Insert: {
          administered_at?: string | null
          administered_on: string
          created_at?: string
          created_by?: string | null
          household_id: string
          id?: string
          medication_id: string
          notes?: string | null
          pet_id: string
        }
        Update: {
          administered_at?: string | null
          administered_on?: string
          created_at?: string
          created_by?: string | null
          household_id?: string
          id?: string
          medication_id?: string
          notes?: string | null
          pet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_administrations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_administrations_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_administrations_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_price_quotes: {
        Row: {
          created_at: string
          created_by: string | null
          household_id: string
          id: string
          link_url: string | null
          medication_id: string
          notes: string | null
          pack_size_label: string | null
          pet_id: string
          price_cents: number
          recorded_on: string
          source: Database["public"]["Enums"]["pharmacy_source"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          household_id: string
          id?: string
          link_url?: string | null
          medication_id: string
          notes?: string | null
          pack_size_label?: string | null
          pet_id: string
          price_cents: number
          recorded_on?: string
          source: Database["public"]["Enums"]["pharmacy_source"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          household_id?: string
          id?: string
          link_url?: string | null
          medication_id?: string
          notes?: string | null
          pack_size_label?: string | null
          pet_id?: string
          price_cents?: number
          recorded_on?: string
          source?: Database["public"]["Enums"]["pharmacy_source"]
        }
        Relationships: [
          {
            foreignKeyName: "medication_price_quotes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_price_quotes_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_price_quotes_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          created_at: string
          created_by: string | null
          document_id: string | null
          dose: string
          duration_days: number | null
          ended_estimated: boolean
          ended_on: string | null
          frequency: string | null
          generic_name: string | null
          household_id: string
          id: string
          indication: string | null
          medication_context: Database["public"]["Enums"]["medication_context"]
          name: string
          notes: string | null
          pet_id: string
          prescriber: string | null
          route: string | null
          started_on: string
          updated_at: string
          vet_clinic_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          dose: string
          duration_days?: number | null
          ended_estimated?: boolean
          ended_on?: string | null
          frequency?: string | null
          generic_name?: string | null
          household_id: string
          id?: string
          indication?: string | null
          medication_context?: Database["public"]["Enums"]["medication_context"]
          name: string
          notes?: string | null
          pet_id: string
          prescriber?: string | null
          route?: string | null
          started_on: string
          updated_at?: string
          vet_clinic_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          dose?: string
          duration_days?: number | null
          ended_estimated?: boolean
          ended_on?: string | null
          frequency?: string | null
          generic_name?: string | null
          household_id?: string
          id?: string
          indication?: string | null
          medication_context?: Database["public"]["Enums"]["medication_context"]
          name?: string
          notes?: string | null
          pet_id?: string
          prescriber?: string | null
          route?: string | null
          started_on?: string
          updated_at?: string
          vet_clinic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medications_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_vet_clinic_id_fkey"
            columns: ["vet_clinic_id"]
            isOneToOne: false
            referencedRelation: "vet_clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_emails: {
        Row: {
          authorization_id: string
          body_html: string | null
          body_text: string
          created_at: string
          created_by: string | null
          error_message: string | null
          household_id: string
          id: string
          pet_id: string | null
          recipient_email: string
          recipient_name: string | null
          recipient_type: Database["public"]["Enums"]["outbound_recipient_type"]
          reply_received_at: string | null
          reply_thread_id: string | null
          resend_message_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["outbound_email_status"]
          subject: string
          template_id: string | null
        }
        Insert: {
          authorization_id: string
          body_html?: string | null
          body_text: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          household_id: string
          id?: string
          pet_id?: string | null
          recipient_email: string
          recipient_name?: string | null
          recipient_type: Database["public"]["Enums"]["outbound_recipient_type"]
          reply_received_at?: string | null
          reply_thread_id?: string | null
          resend_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outbound_email_status"]
          subject: string
          template_id?: string | null
        }
        Update: {
          authorization_id?: string
          body_html?: string | null
          body_text?: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          household_id?: string
          id?: string
          pet_id?: string | null
          recipient_email?: string
          recipient_name?: string | null
          recipient_type?: Database["public"]["Enums"]["outbound_recipient_type"]
          reply_received_at?: string | null
          reply_thread_id?: string | null
          resend_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outbound_email_status"]
          subject?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbound_emails_authorization_id_fkey"
            columns: ["authorization_id"]
            isOneToOne: false
            referencedRelation: "authorizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_emails_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_emails_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_records_requests: {
        Row: {
          created_at: string
          created_by: string | null
          error_message: string | null
          household_id: string
          id: string
          medical_event_id: string | null
          outbound_email_id: string | null
          pet_id: string
          request_summary: string
          scheduled_for: string
          status: Database["public"]["Enums"]["pending_request_status"]
          vet_clinic_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          household_id: string
          id?: string
          medical_event_id?: string | null
          outbound_email_id?: string | null
          pet_id: string
          request_summary: string
          scheduled_for: string
          status?: Database["public"]["Enums"]["pending_request_status"]
          vet_clinic_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          household_id?: string
          id?: string
          medical_event_id?: string | null
          outbound_email_id?: string | null
          pet_id?: string
          request_summary?: string
          scheduled_for?: string
          status?: Database["public"]["Enums"]["pending_request_status"]
          vet_clinic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_records_requests_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_records_requests_medical_event_id_fkey"
            columns: ["medical_event_id"]
            isOneToOne: false
            referencedRelation: "medical_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_records_requests_outbound_email_id_fkey"
            columns: ["outbound_email_id"]
            isOneToOne: false
            referencedRelation: "outbound_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_records_requests_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_records_requests_vet_clinic_id_fkey"
            columns: ["vet_clinic_id"]
            isOneToOne: false
            referencedRelation: "vet_clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          acquired_on: string | null
          allergies: string | null
          altered: boolean | null
          animal_id: string | null
          archived_at: string | null
          breed: string | null
          color: string | null
          created_at: string
          created_by: string | null
          current_weight_kg: number | null
          date_of_birth: string | null
          dob_is_estimated: boolean
          household_id: string
          id: string
          markings: string | null
          microchip_implanted_on: string | null
          microchip_number: string | null
          microchip_registry: string | null
          name: string
          notes: string | null
          photo_storage_path: string | null
          sex: Database["public"]["Enums"]["pet_sex"]
          species: Database["public"]["Enums"]["pet_species"]
          updated_at: string
        }
        Insert: {
          acquired_on?: string | null
          allergies?: string | null
          altered?: boolean | null
          animal_id?: string | null
          archived_at?: string | null
          breed?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          current_weight_kg?: number | null
          date_of_birth?: string | null
          dob_is_estimated?: boolean
          household_id: string
          id?: string
          markings?: string | null
          microchip_implanted_on?: string | null
          microchip_number?: string | null
          microchip_registry?: string | null
          name: string
          notes?: string | null
          photo_storage_path?: string | null
          sex?: Database["public"]["Enums"]["pet_sex"]
          species: Database["public"]["Enums"]["pet_species"]
          updated_at?: string
        }
        Update: {
          acquired_on?: string | null
          allergies?: string | null
          altered?: boolean | null
          animal_id?: string | null
          archived_at?: string | null
          breed?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          current_weight_kg?: number | null
          date_of_birth?: string | null
          dob_is_estimated?: boolean
          household_id?: string
          id?: string
          markings?: string | null
          microchip_implanted_on?: string | null
          microchip_number?: string | null
          microchip_registry?: string | null
          name?: string
          notes?: string | null
          photo_storage_path?: string | null
          sex?: Database["public"]["Enums"]["pet_sex"]
          species?: Database["public"]["Enums"]["pet_species"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pets_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: true
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      qol_entries: {
        Row: {
          created_at: string
          created_by: string | null
          happiness: number
          household_id: string
          hunger: number
          hurt: number
          hydration: number
          hygiene: number
          id: string
          mobility: number
          more_good: number
          notes: string | null
          pet_id: string
          recorded_on: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          happiness: number
          household_id: string
          hunger: number
          hurt: number
          hydration: number
          hygiene: number
          id?: string
          mobility: number
          more_good: number
          notes?: string | null
          pet_id: string
          recorded_on: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          happiness?: number
          household_id?: string
          hunger?: number
          hurt?: number
          hydration?: number
          hygiene?: number
          id?: string
          mobility?: number
          more_good?: number
          notes?: string | null
          pet_id?: string
          recorded_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "qol_entries_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qol_entries_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_preferences: {
        Row: {
          auto_request_lead_days: number
          auto_request_records: boolean
          email_address: string | null
          email_enabled: boolean
          household_id: string
          quiet_hour_end: number | null
          quiet_hour_start: number | null
          timezone: string
          updated_at: string
          vaccine_lead_days: number[]
        }
        Insert: {
          auto_request_lead_days?: number
          auto_request_records?: boolean
          email_address?: string | null
          email_enabled?: boolean
          household_id: string
          quiet_hour_end?: number | null
          quiet_hour_start?: number | null
          timezone?: string
          updated_at?: string
          vaccine_lead_days?: number[]
        }
        Update: {
          auto_request_lead_days?: number
          auto_request_records?: boolean
          email_address?: string | null
          email_enabled?: boolean
          household_id?: string
          quiet_hour_end?: number | null
          quiet_hour_start?: number | null
          timezone?: string
          updated_at?: string
          vaccine_lead_days?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "reminder_preferences_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: true
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          channel: Database["public"]["Enums"]["reminder_channel"]
          created_at: string
          due_on: string
          entity_id: string
          entity_type: string
          error_message: string | null
          household_id: string
          id: string
          lead_days: number
          pet_id: string | null
          resend_message_id: string | null
          scheduled_for: string
          sent_at: string | null
          snoozed_until: string | null
          status: Database["public"]["Enums"]["reminder_status"]
          updated_at: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["reminder_channel"]
          created_at?: string
          due_on: string
          entity_id: string
          entity_type: string
          error_message?: string | null
          household_id: string
          id?: string
          lead_days: number
          pet_id?: string | null
          resend_message_id?: string | null
          scheduled_for: string
          sent_at?: string | null
          snoozed_until?: string | null
          status?: Database["public"]["Enums"]["reminder_status"]
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["reminder_channel"]
          created_at?: string
          due_on?: string
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          household_id?: string
          id?: string
          lead_days?: number
          pet_id?: string | null
          resend_message_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          snoozed_until?: string | null
          status?: Database["public"]["Enums"]["reminder_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      research_consents: {
        Row: {
          animal_id: string | null
          authorization_id: string
          granted_at: string
          household_id: string
          id: string
          revoked_at: string | null
        }
        Insert: {
          animal_id?: string | null
          authorization_id: string
          granted_at?: string
          household_id: string
          id?: string
          revoked_at?: string | null
        }
        Update: {
          animal_id?: string | null
          authorization_id?: string
          granted_at?: string
          household_id?: string
          id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_consents_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_consents_authorization_id_fkey"
            columns: ["authorization_id"]
            isOneToOne: false
            referencedRelation: "authorizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_consents_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      share_links: {
        Row: {
          access_count: number
          created_at: string
          created_by: string | null
          expires_at: string
          household_id: string
          id: string
          last_accessed_at: string | null
          pet_id: string
          recipient_label: string | null
          revoked_at: string | null
          scope: Database["public"]["Enums"]["share_scope"]
          token_hash: string
        }
        Insert: {
          access_count?: number
          created_at?: string
          created_by?: string | null
          expires_at: string
          household_id: string
          id?: string
          last_accessed_at?: string | null
          pet_id: string
          recipient_label?: string | null
          revoked_at?: string | null
          scope?: Database["public"]["Enums"]["share_scope"]
          token_hash: string
        }
        Update: {
          access_count?: number
          created_at?: string
          created_by?: string | null
          expires_at?: string
          household_id?: string
          id?: string
          last_accessed_at?: string | null
          pet_id?: string
          recipient_label?: string | null
          revoked_at?: string | null
          scope?: Database["public"]["Enums"]["share_scope"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_links_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_links_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          household_id: string
          id: string
          plan: string
          status: string
          stripe_subscription_id: string
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          household_id: string
          id?: string
          plan: string
          status: string
          stripe_subscription_id: string
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          household_id?: string
          id?: string
          plan?: string
          status?: string
          stripe_subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      vaccinations: {
        Row: {
          administered_on: string
          administering_vet: string | null
          created_at: string
          created_by: string | null
          document_id: string | null
          expires_on: string | null
          household_id: string
          id: string
          is_rabies: boolean | null
          lot_number: string | null
          manufacturer: string | null
          notes: string | null
          pet_id: string
          reminder_lead_days: number[]
          updated_at: string
          vaccine_family: string | null
          vaccine_type: string
          vet_clinic_id: string | null
        }
        Insert: {
          administered_on: string
          administering_vet?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          expires_on?: string | null
          household_id: string
          id?: string
          is_rabies?: boolean | null
          lot_number?: string | null
          manufacturer?: string | null
          notes?: string | null
          pet_id: string
          reminder_lead_days?: number[]
          updated_at?: string
          vaccine_family?: string | null
          vaccine_type: string
          vet_clinic_id?: string | null
        }
        Update: {
          administered_on?: string
          administering_vet?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          expires_on?: string | null
          household_id?: string
          id?: string
          is_rabies?: boolean | null
          lot_number?: string | null
          manufacturer?: string | null
          notes?: string | null
          pet_id?: string
          reminder_lead_days?: number[]
          updated_at?: string
          vaccine_family?: string | null
          vaccine_type?: string
          vet_clinic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vaccinations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccinations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccinations_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccinations_vet_clinic_id_fkey"
            columns: ["vet_clinic_id"]
            isOneToOne: false
            referencedRelation: "vet_clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_clinics: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          household_id: string
          id: string
          last_seen_at: string | null
          name: string
          notes: string | null
          phone: string | null
          phone_normalized: string | null
          postal_code: string | null
          region: string | null
          updated_at: string
          verified_at: string | null
          verified_source: string | null
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          household_id: string
          id?: string
          last_seen_at?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          phone_normalized?: string | null
          postal_code?: string | null
          region?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_source?: string | null
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          household_id?: string
          id?: string
          last_seen_at?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          phone_normalized?: string | null
          postal_code?: string | null
          region?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_source?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vet_clinics_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_signups: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string | null
        }
        Relationships: []
      }
      weight_log: {
        Row: {
          created_at: string
          created_by: string | null
          document_id: string | null
          household_id: string
          id: string
          notes: string | null
          pet_id: string
          recorded_on: string
          source: Database["public"]["Enums"]["weight_source"]
          weight_kg: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          household_id: string
          id?: string
          notes?: string | null
          pet_id: string
          recorded_on: string
          source?: Database["public"]["Enums"]["weight_source"]
          weight_kg: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          household_id?: string
          id?: string
          notes?: string | null
          pet_id?: string
          recorded_on?: string
          source?: Database["public"]["Enums"]["weight_source"]
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_weight_log_document"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weight_log_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weight_log_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_has_password: { Args: never; Returns: boolean }
      has_household_write: { Args: { p_household: string }; Returns: boolean }
      is_animal_custodian: { Args: { p_animal: string }; Returns: boolean }
      is_household_member: { Args: { p_household: string }; Returns: boolean }
      match_extraction_chunks: {
        Args: {
          match_count: number
          p_household_id: string
          query_embedding: string
        }
        Returns: {
          content: string
          document_id: string
          id: string
          pet_id: string
          similarity: number
          source_path: string
        }[]
      }
      normalize_phone: { Args: { p: string }; Returns: string }
      transfer_animal: {
        Args: {
          p_animal_id: string
          p_to_household_id: string
          p_transfer_id: string
        }
        Returns: undefined
      }
      vaccine_family_of: { Args: { vt: string }; Returns: string }
    }
    Enums: {
      animal_placement_status: "none" | "available" | "reserved" | "placed"
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
        | "preferences_change"
      authorization_type:
        | "records_request_to_vets"
        | "records_distribution_to_third_parties"
        | "insurer_clarification_emails"
        | "affiliate_disclosure_acknowledged"
        | "research_data_sharing"
      claim_status:
        | "drafted"
        | "submitted"
        | "approved"
        | "partially_approved"
        | "denied"
        | "appealed"
        | "closed"
      cost_estimate_status:
        | "pending_vet_response"
        | "computed"
        | "expired"
        | "cancelled"
      custodianship_role: "owner" | "breeder" | "foster" | "co_owner"
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
        | "unknown"
      extraction_feedback_rating:
        | "great"
        | "mostly_good"
        | "many_errors"
        | "unreadable"
        | "wrong_doctype"
      extraction_status: "pending_review" | "committed" | "discarded"
      household_kind: "personal" | "breeder"
      household_role: "owner" | "member" | "viewer"
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
        | "other"
      medication_context:
        | "prescribed_takehome"
        | "intraoperative"
        | "injection_in_office"
        | "otc_recommended"
        | "unknown"
      outbound_email_status:
        | "drafted"
        | "queued"
        | "sent"
        | "bounced"
        | "failed"
        | "replied"
      outbound_recipient_type:
        | "vet_clinic"
        | "insurer"
        | "boarding_facility"
        | "specialist"
        | "pharmacy"
        | "other"
      pending_request_status: "scheduled" | "sent" | "cancelled" | "failed"
      pet_sex: "male" | "female" | "unknown"
      pet_species: "dog" | "cat" | "other"
      pharmacy_source:
        | "chewy"
        | "costco"
        | "goodrx"
        | "1800petmeds"
        | "walmart"
        | "vet_in_house"
        | "other"
      processing_status:
        | "pending"
        | "extracting"
        | "extracted"
        | "confirmed"
        | "failed"
      reminder_channel: "email" | "push" | "sms"
      reminder_status: "scheduled" | "sent" | "failed" | "skipped"
      share_scope: "boarding_packet"
      weight_source: "manual" | "extracted" | "vet_visit"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      animal_placement_status: ["none", "available", "reserved", "placed"],
      audit_action: [
        "create",
        "update",
        "delete",
        "archive",
        "commit_extraction",
        "discard_extraction",
        "invite_member",
        "revoke_member",
        "accept_invitation",
        "login",
        "preferences_change",
      ],
      authorization_type: [
        "records_request_to_vets",
        "records_distribution_to_third_parties",
        "insurer_clarification_emails",
        "affiliate_disclosure_acknowledged",
        "research_data_sharing",
      ],
      claim_status: [
        "drafted",
        "submitted",
        "approved",
        "partially_approved",
        "denied",
        "appealed",
        "closed",
      ],
      cost_estimate_status: [
        "pending_vet_response",
        "computed",
        "expired",
        "cancelled",
      ],
      custodianship_role: ["owner", "breeder", "foster", "co_owner"],
      document_type: [
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
      ],
      extraction_feedback_rating: [
        "great",
        "mostly_good",
        "many_errors",
        "unreadable",
        "wrong_doctype",
      ],
      extraction_status: ["pending_review", "committed", "discarded"],
      household_kind: ["personal", "breeder"],
      household_role: ["owner", "member", "viewer"],
      medical_event_type: [
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
      ],
      medication_context: [
        "prescribed_takehome",
        "intraoperative",
        "injection_in_office",
        "otc_recommended",
        "unknown",
      ],
      outbound_email_status: [
        "drafted",
        "queued",
        "sent",
        "bounced",
        "failed",
        "replied",
      ],
      outbound_recipient_type: [
        "vet_clinic",
        "insurer",
        "boarding_facility",
        "specialist",
        "pharmacy",
        "other",
      ],
      pending_request_status: ["scheduled", "sent", "cancelled", "failed"],
      pet_sex: ["male", "female", "unknown"],
      pet_species: ["dog", "cat", "other"],
      pharmacy_source: [
        "chewy",
        "costco",
        "goodrx",
        "1800petmeds",
        "walmart",
        "vet_in_house",
        "other",
      ],
      processing_status: [
        "pending",
        "extracting",
        "extracted",
        "confirmed",
        "failed",
      ],
      reminder_channel: ["email", "push", "sms"],
      reminder_status: ["scheduled", "sent", "failed", "skipped"],
      share_scope: ["boarding_packet"],
      weight_source: ["manual", "extracted", "vet_visit"],
    },
  },
} as const
