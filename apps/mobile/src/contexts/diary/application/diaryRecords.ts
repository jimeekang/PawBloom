import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../shared-kernel/supabase/client";
import type { Database } from "../../../shared-kernel/supabase/database.types";
import { uploadDiaryPhoto } from "../../media/application/mediaUpload";
import type { CreateDiaryEntryInput, DiaryEntry } from "../domain/diaryEntry";

type DiaryRow = Database["public"]["Tables"]["diary_entries"]["Row"];
type DiaryInsert = Database["public"]["Tables"]["diary_entries"]["Insert"];
type DiaryRowWithMedia = DiaryRow & { media_assets?: { id: string }[] | null };

export const diaryKeys = {
  today: (petId: string | null) => ["diary", "today", petId] as const,
  date: (petId: string | null, dateKey: string) => ["diary", "date", petId, dateKey] as const,
  range: (petId: string | null, fromDateKey: string, toDateKey: string) => ["diary", "range", petId, fromDateKey, toDateKey] as const,
};

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getWeekDateRange(dateKey: string) {
  const date = parseDateKey(dateKey);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = addDays(date, mondayOffset);
  const end = addDays(start, 6);

  return { fromDateKey: getLocalDateKey(start), toDateKey: getLocalDateKey(end) };
}

export function mapDiaryRow(row: DiaryRowWithMedia): DiaryEntry {
  return {
    id: row.id,
    petId: row.pet_id,
    category: row.category,
    entryDate: row.entry_date,
    occurredAt: formatTime(row.occurred_at),
    summary: row.summary,
    conditionScore: normalizeScore(row.condition_score),
    photoCount: row.media_assets?.length ?? 0,
  };
}

export function useDiaryEntriesByDate(petId: string | null, dateKey: string) {
  return useQuery({
    queryKey: diaryKeys.date(petId, dateKey),
    enabled: Boolean(supabase && petId && dateKey),
    queryFn: async () => {
      if (!supabase || !petId) {
        return [];
      }

      return fetchDiaryEntries(petId, dateKey, dateKey);
    },
  });
}

export function useDiaryEntriesByDateRange(petId: string | null, fromDateKey: string, toDateKey: string) {
  return useQuery({
    queryKey: diaryKeys.range(petId, fromDateKey, toDateKey),
    enabled: Boolean(supabase && petId && fromDateKey && toDateKey),
    queryFn: async () => {
      if (!supabase || !petId) {
        return [];
      }

      return fetchDiaryEntries(petId, fromDateKey, toDateKey);
    },
  });
}

export function useTodayDiaryEntries(petId: string | null) {
  return useDiaryEntriesByDate(petId, getLocalDateKey());
}

export function useCreateDiaryEntry(petId: string | null, userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateDiaryEntryInput) => {
      if (!supabase || !petId || !userId) {
        throw new Error("로그인이 필요합니다.");
      }

      if ((input.photos?.length ?? 0) > 5) {
        throw new Error("하루 사진은 최대 5장까지 저장할 수 있습니다.");
      }

      const entryDate = input.entryDate ?? getLocalDateKey();
      const payload: DiaryInsert = {
        pet_id: petId,
        created_by: userId,
        category: input.category,
        summary: input.summary.trim() || defaultSummary(input.category),
        condition_score: input.category === "condition" ? input.conditionScore ?? 3 : null,
        entry_date: entryDate,
        occurred_at: buildOccurredAt(entryDate),
      };

      const { data, error } = await supabase.from("diary_entries").insert(payload).select().single();
      if (error) {
        throw new Error(error.message);
      }

      for (const [index, photo] of (input.photos ?? []).entries()) {
        await uploadDiaryPhoto(supabase, userId, petId, data.id, photo, index + 1);
      }

      return { ...mapDiaryRow({ ...data, media_assets: input.photos?.map((_, index) => ({ id: `${data.id}-${index}` })) ?? [] }), entryDate };
    },
    onSuccess: (entry) => {
      queryClient.setQueryData<DiaryEntry[]>(diaryKeys.date(petId, entry.entryDate), (current) => [entry, ...(current ?? [])]);
      void queryClient.invalidateQueries({ queryKey: ["diary"] });
    },
  });
}

async function fetchDiaryEntries(petId: string, fromDateKey: string, toDateKey: string) {
  const { data, error } = await supabase!
    .from("diary_entries")
    .select("id,pet_id,category,occurred_at,summary,condition_score,entry_date,created_by,client_mutation_id,created_at,updated_at,media_assets(id)")
    .eq("pet_id", petId)
    .gte("entry_date", fromDateKey)
    .lte("entry_date", toDateKey)
    .order("occurred_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as DiaryRowWithMedia[]).map(mapDiaryRow);
}

function defaultSummary(category: CreateDiaryEntryInput["category"]) {
  const labels: Record<CreateDiaryEntryInput["category"], string> = {
    food: "식사가 기록되었습니다.",
    water: "물 섭취가 기록되었습니다.",
    walk: "산책이 기록되었습니다.",
    stool: "배변이 기록되었습니다.",
    condition: "컨디션 체크가 기록되었습니다.",
    memo: "메모가 기록되었습니다.",
  };
  return labels[category];
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function buildOccurredAt(dateKey: string) {
  const now = new Date();
  const occurredAt = parseDateKey(dateKey);
  occurredAt.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return occurredAt.toISOString();
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function normalizeScore(value: number | null): 1 | 2 | 3 | 4 | 5 | undefined {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) {
    return value;
  }
  return undefined;
}
