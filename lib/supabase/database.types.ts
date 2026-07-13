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

export type Database = {
  public: {
    Tables: {
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
    };
    Enums: {
      organization_role: OrganizationRole;
      assessment_status: AssessmentStatus;
      reasoning_stage: ReasoningStage;
      reasoning_status: ReasoningStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
