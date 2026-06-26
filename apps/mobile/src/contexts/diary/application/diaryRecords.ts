import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../shared-kernel/supabase/client";
import type { Database } from "../../../shared-kernel/supabase/database.types";
import type { CreateDiaryEntryInput, DiaryEntry } from "../domain/diaryEntry";

type DiaryRow = Database["public"]["Tables"]["diary_entries"]["Row"];
type DiaryInsert = Database["public"]["Tables"]["diary_entries"]["Insert"];

export const diaryKeys = {
  today: (petId: string | null) => ["diary", "today", petId] as const,
};

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function mapDiaryRow(row: DiaryRow): DiaryEntry {
  return {
    id: row.id,
    petId: row.pet_id,
    category: row.category,
    occurredAt: formatTime(row.occurred_at),
    summary: row.summary,
    conditionScore: normalizeScore(row.condition_score),
  };
}

export function useTodayDiaryEntries(petId: string | null) {
  return useQuery({
    queryKey: diaryKeys.today(petId),
    enabled: Boolean(supabase && petId),
    queryFn: async () => {
      if (!supabase || !petId) {
        return [];
      }

      const { data, error } = await supabase
        .from("diary_entries")
        .select("id,pet_id,category,occurred_at,summary,condition_score,entry_date,created_by,client_mutation_id,created_at,updated_at")
        .eq("pet_id", petId)
        .eq("entry_date", getLocalDateKey())
        .order("occurred_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? []).map(mapDiaryRow);
    },
  });
}

export function useCreateDiaryEntry(petId: string | null, userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateDiaryEntryInput) => {
      if (!supabase || !petId || !userId) {
        throw new Error("Authentication required.");
      }

      const payload: DiaryInsert = {
        pet_id: petId,
        created_by: userId,
        category: input.category,
        summary: input.summary.trim() || defaultSummary(input.category),
        condition_score: input.category === "condition" ? input.conditionScore ?? 3 : null,
        entry_date: getLocalDateKey(),
        occurred_at: new Date().toISOString(),
      };

      const { data, error } = await supabase.from("diary_entries").insert(payload).select().single();
      if (error) {
        throw new Error(error.message);
      }

      return mapDiaryRow(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: diaryKeys.today(petId) });
    },
  });
}

function defaultSummary(category: CreateDiaryEntryInput["category"]) {
  const labels: Record<CreateDiaryEntryInput["category"], string> = {
    food: "Food recorded.",
    water: "Water recorded.",
    walk: "Walk recorded.",
    stool: "Stool recorded.",
    condition: "Condition check recorded.",
    memo: "Memo recorded.",
  };
  return labels[category];
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function normalizeScore(value: number | null): 1 | 2 | 3 | 4 | 5 | undefined {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) {
    return value;
  }
  return undefined;
}
