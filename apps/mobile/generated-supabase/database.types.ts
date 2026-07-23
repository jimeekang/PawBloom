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
      ai_briefs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          payload: Json
          pet_id: string
          range_days: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          payload: Json
          pet_id: string
          range_days: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          payload?: Json
          pet_id?: string
          range_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_briefs_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          pet_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          pet_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          pet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      care_plans: {
        Row: {
          condition_id: string | null
          created_at: string
          created_by: string | null
          ends_on: string | null
          id: string
          instructions: string | null
          pet_id: string
          starts_on: string
          title: string
          updated_at: string
        }
        Insert: {
          condition_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          instructions?: string | null
          pet_id: string
          starts_on?: string
          title: string
          updated_at?: string
        }
        Update: {
          condition_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          instructions?: string | null
          pet_id?: string
          starts_on?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_plans_condition_id_fkey"
            columns: ["condition_id"]
            isOneToOne: false
            referencedRelation: "conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_plans_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      conditions: {
        Row: {
          created_at: string
          created_by: string | null
          ends_on: string | null
          id: string
          name: string
          pet_id: string
          starts_on: string
          status: string
          updated_at: string
          vet_instructions: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          name: string
          pet_id: string
          starts_on?: string
          status?: string
          updated_at?: string
          vet_instructions?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          name?: string
          pet_id?: string
          starts_on?: string
          status?: string
          updated_at?: string
          vet_instructions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conditions_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_entries: {
        Row: {
          category: Database["public"]["Enums"]["diary_entry_category"]
          client_mutation_id: string | null
          condition_score: number | null
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          occurred_at: string
          pet_id: string
          record_origin: string
          summary: string
          superseded_by: string | null
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["diary_entry_category"]
          client_mutation_id?: string | null
          condition_score?: number | null
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          occurred_at?: string
          pet_id: string
          record_origin?: string
          summary: string
          superseded_by?: string | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["diary_entry_category"]
          client_mutation_id?: string | null
          condition_score?: number | null
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          occurred_at?: string
          pet_id?: string
          record_origin?: string
          summary?: string
          superseded_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_entries_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_entries_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "diary_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      measurements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          measured_at: string
          pet_id: string
          value: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          measured_at?: string
          pet_id: string
          value: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          measured_at?: string
          pet_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "measurements_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          content_type: string
          created_at: string
          created_by: string | null
          diary_entry_id: string | null
          id: string
          pet_id: string
          storage_path: string
        }
        Insert: {
          content_type: string
          created_at?: string
          created_by?: string | null
          diary_entry_id?: string | null
          id?: string
          pet_id: string
          storage_path: string
        }
        Update: {
          content_type?: string
          created_at?: string
          created_by?: string | null
          diary_entry_id?: string | null
          id?: string
          pet_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_diary_entry_id_fkey"
            columns: ["diary_entry_id"]
            isOneToOne: false
            referencedRelation: "diary_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_doses: {
        Row: {
          client_mutation_id: string | null
          created_at: string
          created_by: string | null
          dose_date: string
          id: string
          medication_name: string
          pet_id: string
          reaction_note: string | null
          recorded_at: string | null
          schedule_id: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["dose_status"]
          updated_at: string
        }
        Insert: {
          client_mutation_id?: string | null
          created_at?: string
          created_by?: string | null
          dose_date: string
          id?: string
          medication_name: string
          pet_id: string
          reaction_note?: string | null
          recorded_at?: string | null
          schedule_id?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["dose_status"]
          updated_at?: string
        }
        Update: {
          client_mutation_id?: string | null
          created_at?: string
          created_by?: string | null
          dose_date?: string
          id?: string
          medication_name?: string
          pet_id?: string
          reaction_note?: string | null
          recorded_at?: string | null
          schedule_id?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["dose_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_doses_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_doses_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "medication_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_schedules: {
        Row: {
          created_at: string
          created_by: string | null
          ends_on: string | null
          id: string
          local_time: string
          medication_id: string
          pet_id: string
          recurrence_interval_days: number
          starts_on: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          local_time: string
          medication_id: string
          pet_id: string
          recurrence_interval_days?: number
          starts_on?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          local_time?: string
          medication_id?: string
          pet_id?: string
          recurrence_interval_days?: number
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_schedules_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_schedules_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          condition_id: string | null
          created_at: string
          created_by: string | null
          dosage_label: string
          id: string
          name: string
          pet_id: string
          updated_at: string
          vet_instructions: string | null
        }
        Insert: {
          condition_id?: string | null
          created_at?: string
          created_by?: string | null
          dosage_label: string
          id?: string
          name: string
          pet_id: string
          updated_at?: string
          vet_instructions?: string | null
        }
        Update: {
          condition_id?: string | null
          created_at?: string
          created_by?: string | null
          dosage_label?: string
          id?: string
          name?: string
          pet_id?: string
          updated_at?: string
          vet_instructions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medications_condition_id_fkey"
            columns: ["condition_id"]
            isOneToOne: false
            referencedRelation: "conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_members: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          pet_id: string
          role: Database["public"]["Enums"]["pet_member_role"]
          starts_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          pet_id: string
          role: Database["public"]["Enums"]["pet_member_role"]
          starts_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          pet_id?: string
          role?: Database["public"]["Enums"]["pet_member_role"]
          starts_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_members_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_routines: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          pet_id: string
          routine: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          pet_id: string
          routine?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          pet_id?: string
          routine?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_routines_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: true
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          birthdate: string | null
          breed: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          species: string
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          birthdate?: string | null
          breed?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          species: string
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          birthdate?: string | null
          breed?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          species?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          language: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          language?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          language?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_share_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          last_accessed_at: string | null
          report_id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          last_accessed_at?: string | null
          report_id: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          last_accessed_at?: string | null
          report_id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_share_tokens_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "vet_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_entitlements: {
        Row: {
          active_until: string | null
          created_at: string
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_until?: string | null
          created_at?: string
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_until?: string | null
          created_at?: string
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sync_outbox: {
        Row: {
          aggregate: string
          client_mutation_id: string
          created_at: string
          id: string
          operation: string
          payload: Json
          processed_at: string | null
          user_id: string
        }
        Insert: {
          aggregate: string
          client_mutation_id: string
          created_at?: string
          id?: string
          operation: string
          payload: Json
          processed_at?: string | null
          user_id: string
        }
        Update: {
          aggregate?: string
          client_mutation_id?: string
          created_at?: string
          id?: string
          operation?: string
          payload?: Json
          processed_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vet_reports: {
        Row: {
          confirmed_by_owner: boolean
          created_at: string
          created_by: string | null
          english_summary: string
          id: string
          payload: Json
          pet_id: string
          range_days: number
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
        }
        Insert: {
          confirmed_by_owner?: boolean
          created_at?: string
          created_by?: string | null
          english_summary: string
          id?: string
          payload: Json
          pet_id: string
          range_days: number
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Update: {
          confirmed_by_owner?: boolean
          created_at?: string
          created_by?: string | null
          english_summary?: string
          id?: string
          payload?: Json
          pet_id?: string
          range_days?: number
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vet_reports_pet_id_fkey"
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
      complete_media_cleanup_v1: {
        Args: { p_storage_paths: string[] }
        Returns: number
      }
      confirm_vet_report: {
        Args: { target_pet_id: string; target_report_id: string }
        Returns: {
          confirmed_by_owner: boolean
          id: string
          status: Database["public"]["Enums"]["report_status"]
        }[]
      }
      create_photo_diary_entry: {
        Args: {
          p_client_mutation_id: string
          p_entry_date: string
          p_entry_id: string
          p_media: Json
          p_occurred_at: string
          p_pet_id: string
          p_summary: string
        }
        Returns: {
          category: Database["public"]["Enums"]["diary_entry_category"]
          client_mutation_id: string | null
          condition_score: number | null
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          occurred_at: string
          pet_id: string
          record_origin: string
          summary: string
          superseded_by: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "diary_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_photo_diary_entry: {
        Args: {
          p_append_mutation_id: string
          p_entry_id: string
          p_media: Json
          p_occurred_at: string
          p_pet_id: string
        }
        Returns: {
          category: Database["public"]["Enums"]["diary_entry_category"]
          client_mutation_id: string | null
          condition_score: number | null
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          occurred_at: string
          pet_id: string
          record_origin: string
          summary: string
          superseded_by: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "diary_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_vet_report_draft_v1: {
        Args: {
          p_created_by: string
          p_english_summary: string
          p_payload: Json
          p_pet_id: string
          p_range_days: number
        }
        Returns: string
      }
      delete_diary_entry_v1: {
        Args: { p_entry_id: string; p_pet_id: string }
        Returns: Json
      }
      delete_pet_v1: { Args: { p_pet_id: string }; Returns: Json }
      issue_vet_report_share_v1: {
        Args: {
          p_actor_id: string
          p_expires_at: string
          p_pet_id: string
          p_report_id: string
          p_token_hash: string
        }
        Returns: Json
      }
      list_pending_media_cleanup_v1: { Args: never; Returns: string[] }
      lookup_profile_id_by_email: {
        Args: { target_email: string }
        Returns: string
      }
      replace_pet_profile_photo_v1: {
        Args: {
          p_content_type: string
          p_pet_id: string
          p_storage_path: string
        }
        Returns: Json
      }
      revoke_vet_report_share_v1: {
        Args: { p_actor_id: string; p_pet_id: string; p_report_id: string }
        Returns: Json
      }
      save_care_setup_v1: {
        Args: { p_pet_id: string; p_request: Json }
        Returns: Json
      }
    }
    Enums: {
      diary_entry_category:
        | "food"
        | "water"
        | "walk"
        | "stool"
        | "condition"
        | "memo"
        | "photo"
      dose_status: "pending" | "completed" | "skipped" | "partial"
      pet_member_role: "owner" | "caregiver" | "pet_sitter"
      report_status: "draft" | "confirmed" | "shared"
      subscription_plan: "free" | "plus" | "family"
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
      diary_entry_category: [
        "food",
        "water",
        "walk",
        "stool",
        "condition",
        "memo",
        "photo",
      ],
      dose_status: ["pending", "completed", "skipped", "partial"],
      pet_member_role: ["owner", "caregiver", "pet_sitter"],
      report_status: ["draft", "confirmed", "shared"],
      subscription_plan: ["free", "plus", "family"],
    },
  },
} as const
