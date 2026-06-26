export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; email: string | null; language: "en" | "ko"; created_at: string; updated_at: string };
        Insert: { id: string; email?: string | null; language?: "en" | "ko"; created_at?: string; updated_at?: string };
        Update: { email?: string | null; language?: "en" | "ko"; updated_at?: string };
      };
      pets: {
        Row: { id: string; owner_id: string; name: string; species: string; breed: string | null; birthdate: string | null; weight_kg: number | null; created_at: string; updated_at: string };
        Insert: { id?: string; owner_id: string; name: string; species: string; breed?: string | null; birthdate?: string | null; weight_kg?: number | null; created_at?: string; updated_at?: string };
        Update: { name?: string; species?: string; breed?: string | null; birthdate?: string | null; weight_kg?: number | null; updated_at?: string };
      };
      pet_members: {
        Row: { id: string; pet_id: string; user_id: string; role: "owner" | "caregiver" | "pet_sitter"; starts_at: string | null; ends_at: string | null; created_at: string };
        Insert: { id?: string; pet_id: string; user_id: string; role: "owner" | "caregiver" | "pet_sitter"; starts_at?: string | null; ends_at?: string | null; created_at?: string };
        Update: { role?: "owner" | "caregiver" | "pet_sitter"; starts_at?: string | null; ends_at?: string | null };
      };
      diary_entries: {
        Row: { id: string; pet_id: string; created_by: string; category: string; entry_date: string; occurred_at: string; summary: string; condition_score: number | null; created_at: string; updated_at: string; client_mutation_id: string | null };
        Insert: { id?: string; pet_id: string; created_by: string; category: string; entry_date: string; occurred_at: string; summary: string; condition_score?: number | null; client_mutation_id?: string | null };
        Update: { category?: string; entry_date?: string; occurred_at?: string; summary?: string; condition_score?: number | null; updated_at?: string };
      };
      medication_doses: {
        Row: { id: string; pet_id: string; schedule_id: string | null; medication_name: string; scheduled_at: string; status: string; recorded_at: string | null; reaction_note: string | null; created_by: string; client_mutation_id: string | null };
        Insert: { id?: string; pet_id: string; schedule_id?: string | null; medication_name: string; scheduled_at: string; status: string; recorded_at?: string | null; reaction_note?: string | null; created_by: string; client_mutation_id?: string | null };
        Update: { status?: string; recorded_at?: string | null; reaction_note?: string | null };
      };
      ai_briefs: {
        Row: { id: string; pet_id: string; range_days: number; payload: Json; created_by: string; created_at: string };
        Insert: { id?: string; pet_id: string; range_days: number; payload: Json; created_by: string; created_at?: string };
        Update: never;
      };
      vet_reports: {
        Row: { id: string; pet_id: string; range_days: number; status: string; english_summary: string; payload: Json; confirmed_by_owner: boolean; created_by: string; created_at: string };
        Insert: { id?: string; pet_id: string; range_days: number; status?: string; english_summary: string; payload: Json; confirmed_by_owner?: boolean; created_by: string; created_at?: string };
        Update: { status?: string; english_summary?: string; payload?: Json; confirmed_by_owner?: boolean };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

