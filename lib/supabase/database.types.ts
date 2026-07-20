export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type OrganizationRole = "owner" | "member";
type AssessmentStatus = "draft" | "running" | "completed" | "failed";
type ReasoningStage = "extraction" | "classification" | "gap_analysis" | "synthesis";
type ReasoningStatus = "pending" | "running" | "completed" | "failed";
type EvidenceStatus =
  | "verified"
  | "documented"
  | "detected"
  | "declared"
  | "partial"
  | "missing"
  | "unverified"
  | "not-applicable";

export type Database = {
  public: {
    Tables: {
      assessment_evidence: {
        Row: {
          assessment_id: string;
          organization_id: string;
          id: string;
          sort_order: number;
          control: string;
          status: EvidenceStatus;
          detail: string;
          gap_id: string | null;
          article_references: string[];
          owner: string | null;
          source_type: string;
          source_label: string | null;
          file_name: string | null;
          file_size_bytes: number | null;
          sha256: string | null;
          collected_at: string | null;
          valid_until: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          reviewed_by_user_id: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          assessment_id: string;
          organization_id: string;
          id: string;
          sort_order: number;
          control: string;
          status: EvidenceStatus;
          detail: string;
          gap_id?: string | null;
          article_references?: string[];
          owner?: string | null;
          source_type: string;
          source_label?: string | null;
          file_name?: string | null;
          file_size_bytes?: number | null;
          sha256?: string | null;
          collected_at?: string | null;
          valid_until?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          reviewed_by_user_id?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          sort_order?: number;
          control?: string;
          status?: EvidenceStatus;
          detail?: string;
          gap_id?: string | null;
          article_references?: string[];
          owner?: string | null;
          source_type?: string;
          source_label?: string | null;
          file_name?: string | null;
          file_size_bytes?: number | null;
          sha256?: string | null;
          collected_at?: string | null;
          valid_until?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          reviewed_by_user_id?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      assessment_evidence_events: {
        Row: {
          id: string;
          assessment_id: string;
          organization_id: string;
          evidence_id: string;
          event_type: string;
          previous_status: EvidenceStatus | null;
          next_status: EvidenceStatus | null;
          previous_snapshot: Json | null;
          after_snapshot: Json | null;
          actor_user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          assessment_id: string;
          organization_id: string;
          evidence_id: string;
          event_type: string;
          previous_status?: EvidenceStatus | null;
          next_status?: EvidenceStatus | null;
          previous_snapshot?: Json | null;
          after_snapshot?: Json | null;
          actor_user_id?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      assessment_rate_limits: {
        Row: {
          user_id: string;
          window_started_at: string;
          request_count: number;
        };
        Insert: {
          user_id: string;
          window_started_at?: string;
          request_count?: number;
        };
        Update: {
          window_started_at?: string;
          request_count?: number;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          owner_user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          owner_user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          organization_id: string;
          user_id: string;
          role: OrganizationRole;
          created_at: string;
        };
        Insert: {
          organization_id: string;
          user_id: string;
          role?: OrganizationRole;
          created_at?: string;
        };
        Update: { role?: OrganizationRole };
        Relationships: [];
      };
      ai_systems: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string;
          sector: string | null;
          lifecycle_status: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description: string;
          sector?: string | null;
          lifecycle_status?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string;
          sector?: string | null;
          lifecycle_status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      assessments: {
        Row: {
          id: string;
          organization_id: string;
          ai_system_id: string;
          status: AssessmentStatus;
          source_description: string;
          structured_facts: Json | null;
          classification: Json | null;
          gaps: Json | null;
          report_payload: Json | null;
          evidence_revision: number;
          score: number | null;
          tier: string | null;
          error_message: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          ai_system_id: string;
          status?: AssessmentStatus;
          source_description: string;
          structured_facts?: Json | null;
          classification?: Json | null;
          gaps?: Json | null;
          report_payload?: Json | null;
          evidence_revision?: number;
          score?: number | null;
          tier?: string | null;
          error_message?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: {
          status?: AssessmentStatus;
          source_description?: string;
          structured_facts?: Json | null;
          classification?: Json | null;
          gaps?: Json | null;
          report_payload?: Json | null;
          evidence_revision?: number;
          score?: number | null;
          tier?: string | null;
          error_message?: string | null;
          updated_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      reasoning_steps: {
        Row: {
          id: string;
          organization_id: string;
          assessment_id: string;
          sequence: number;
          stage: ReasoningStage;
          status: ReasoningStatus;
          model: string;
          input: Json | null;
          output: Json | null;
          error_message: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          assessment_id: string;
          sequence: number;
          stage: ReasoningStage;
          status?: ReasoningStatus;
          model: string;
          input?: Json | null;
          output?: Json | null;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          status?: ReasoningStatus;
          model?: string;
          input?: Json | null;
          output?: Json | null;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      consume_assessment_quota: {
        Args: Record<string, never>;
        Returns: Array<{
          allowed: boolean;
          remaining: number;
          retry_after_seconds: number;
          request_limit: number;
          window_seconds: number;
        }>;
      };
      is_organization_member: {
        Args: { target_organization_id: string };
        Returns: boolean;
      };
      is_organization_owner: {
        Args: { target_organization_id: string };
        Returns: boolean;
      };
      persist_completed_assessment: {
        Args: {
          p_assessment_id: string;
          p_organization_name: string;
          p_system_name: string;
          p_system_description: string;
          p_sector: string | null;
          p_source_description: string;
          p_structured_facts: Json;
          p_classification: Json;
          p_gaps: Json;
          p_report_payload: Json;
          p_score: number;
          p_tier: string;
          p_reasoning_steps: Json;
        };
        Returns: Array<{
          assessment_id: string;
          ai_system_id: string;
        }>;
      };
      sync_assessment_evidence: {
        Args: {
          p_assessment_id: string;
          p_evidence: Json;
          p_expected_revision: number;
        };
        Returns: Json;
      };
    };
    Enums: {
      organization_role: OrganizationRole;
      assessment_status: AssessmentStatus;
      reasoning_stage: ReasoningStage;
      reasoning_status: ReasoningStatus;
      evidence_status: EvidenceStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
