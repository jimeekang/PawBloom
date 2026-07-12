import { type QueryClient, type QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../shared-kernel/supabase/client";
import type { Database } from "../../../shared-kernel/supabase/database.types";
import { uploadDiaryPhoto } from "../../media/application/mediaUpload";
import { enqueueOfflineMutation } from "../../sync/application/offlineOutbox";
import { buildDiaryInsertOfflineMutation } from "./diaryOfflineReplay";
import type { CreateDiaryEntryInput, DiaryCategory, DiaryEntry } from "../domain/diaryEntry";
import { inferDiaryRecordOrigin } from "./diaryRecordOrigin";
import { buildDiaryUpdatePayload, buildOccurredAt, buildOccurredAtForTime, isStructuredDailyCategory, type DiaryUpdateInput } from "./diaryRecordPayload";
import { decodeDiarySummary, defaultDiarySummary, encodeDiarySummary } from "./diarySummary";

export { buildDiaryUpdatePayload } from "./diaryRecordPayload";
export { decodeDiarySummary, encodeDiarySummary } from "./diarySummary";

type DiaryRow = Database["public"]["Tables"]["diary_entries"]["Row"];
type DiaryInsert = Database["public"]["Tables"]["diary_entries"]["Insert"];
type DiaryRowWithMedia = DiaryRow & { media_assets?: { id: string }[] | null };

export const diaryEntrySelect = "id,pet_id,category,occurred_at,summary,condition_score,entry_date,record_origin,created_by,client_mutation_id,created_at,updated_at,media_assets(id)";

export type UpdateDiaryEntryInput = DiaryUpdateInput;

export const diaryKeys = {
  date: (petId: string | null, dateKey: string) => ["diary", "date", petId, dateKey] as const,
  range: (petId: string | null, fromDateKey: string, toDateKey: string) => ["diary", "range", petId, fromDateKey, toDateKey] as const,
};

import { getLocalDateKey } from "../../../shared-kernel/date";

export { getLocalDateKey };

export function getWeekDateRange(dateKey: string) {
  const date = parseDateKey(dateKey), day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = addDays(date, mondayOffset);
  return { fromDateKey: getLocalDateKey(start), toDateKey: getLocalDateKey(addDays(start, 6)) };
}

export function mapDiaryRow(row: DiaryRowWithMedia): DiaryEntry {
  const decoded = decodeDiarySummary(row.summary, row.category);

  return {
    id: row.id,
    petId: row.pet_id,
    category: row.category,
    origin: inferDiaryRecordOrigin({ storedOrigin: row.record_origin, summary: decoded.summary }),
    entryDate: row.entry_date,
    occurredAt: formatTime(row.occurred_at),
    summary: decoded.summary,
    memo: decoded.memo,
    detail: decoded.detail,
    conditionScore: normalizeScore(row.condition_score),
    photoCount: row.media_assets?.length ?? 0,
  };
}

export function removeDiaryEntryFromList<T extends { id: string }>(entries: T[] | undefined, id: string) {
  return (entries ?? []).filter((entry) => entry.id !== id);
}

export function useDiaryEntriesByDate(petId: string | null, dateKey: string) {
  return useQuery({
    queryKey: diaryKeys.date(petId, dateKey),
    enabled: Boolean(supabase && petId && dateKey),
    queryFn: async () => (!supabase || !petId ? [] : fetchDiaryEntries(petId, dateKey, dateKey)),
  });
}

export function useDiaryEntriesByDateRange(petId: string | null, fromDateKey: string, toDateKey: string) {
  return useQuery({
    queryKey: diaryKeys.range(petId, fromDateKey, toDateKey),
    enabled: Boolean(supabase && petId && fromDateKey && toDateKey),
    queryFn: async () => (!supabase || !petId ? [] : fetchDiaryEntries(petId, fromDateKey, toDateKey)),
  });
}

export function useTodayDiaryEntries(petId: string | null) { return useDiaryEntriesByDate(petId, getLocalDateKey()); }

export function useUpdateDiaryEntry(petId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateDiaryEntryInput) => {
      if (!supabase || !petId) throw new Error("로그인이 필요합니다.");
      const { data, error } = await supabase.from("diary_entries").update(buildDiaryUpdatePayload(input)).eq("id", input.id).eq("pet_id", petId).select(diaryEntrySelect).single();
      if (error) throw new Error(error.message);
      return mapDiaryRow(data as DiaryRowWithMedia);
    },
    onSuccess: (entry) => {
      removeDiaryEntryFromCachedLists(queryClient, petId, entry.id);
      upsertDiaryEntryInCachedLists(queryClient, petId, entry);
      void queryClient.invalidateQueries({ queryKey: ["diary"] });
    },
  });
}

export function useDeleteDiaryEntry(petId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase || !petId) throw new Error("로그인이 필요합니다.");
      const { data, error } = await supabase.from("diary_entries").delete().eq("id", id).eq("pet_id", petId).select(diaryEntrySelect).single();
      if (error) throw new Error(error.message);
      return mapDiaryRow(data as DiaryRowWithMedia);
    },
    onSuccess: (entry) => {
      removeDiaryEntryFromCachedLists(queryClient, petId, entry.id);
      void queryClient.invalidateQueries({ queryKey: ["diary"] });
    },
  });
}

export function useCreateDiaryEntry(petId: string | null, userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDiaryEntryInput) => {
      if (!supabase || !petId || !userId) throw new Error("로그인이 필요합니다.");
      if ((input.photos?.length ?? 0) > 5) throw new Error("하루 사진은 최대 5장까지 저장할 수 있습니다.");
      const entryDate = input.entryDate ?? getLocalDateKey();
      const existingEntry = isStructuredDailyCategory(input.category) ? await fetchExistingDailyStructuredEntry(petId, input.category, entryDate) : null;
      if (existingEntry) {
        if (input.origin === "checklist") return mapDiaryRow(existingEntry);
        const { data, error } = await supabase.from("diary_entries").update(buildDiaryUpdatePayload({ ...input, id: existingEntry.id, entryDate, origin: "diary" })).eq("id", existingEntry.id).eq("pet_id", petId).select(diaryEntrySelect).single();
        if (error) throw new Error(error.message);
        return mapDiaryRow(data as DiaryRowWithMedia);
      }
      const payload: DiaryInsert = {
        pet_id: petId,
        created_by: userId,
        category: input.category,
        summary: encodeDiarySummary({ category: input.category, memo: input.summary, detail: input.detail }) || defaultDiarySummary(input.category),
        condition_score: input.category === "condition" ? input.conditionScore ?? 3 : null,
        entry_date: entryDate,
        record_origin: input.origin === "checklist" ? "checklist" : "diary",
        occurred_at: buildOccurredAtForTime(entryDate, input.occurredTime) ?? buildOccurredAt(entryDate),
      };

      const { data, error } = await supabase.from("diary_entries").insert(payload).select(diaryEntrySelect).single();
      if (error) {
        await enqueueOfflineMutation(buildDiaryInsertOfflineMutation({ petId, userId, input: input as unknown as Record<string, unknown> }));
        throw new Error(error.message);
      }

      for (const [index, photo] of (input.photos ?? []).entries()) {
        await uploadDiaryPhoto(supabase, userId, petId, data.id, photo, index + 1);
      }

      return mapDiaryRow({ ...data, media_assets: input.photos?.map((_, index) => ({ id: `${data.id}-${index}` })) ?? [] } as DiaryRowWithMedia);
    },
    onSuccess: (entry) => {
      upsertDiaryEntryInCachedLists(queryClient, petId, entry);
      void queryClient.invalidateQueries({ queryKey: ["diary"] });
    },
  });
}

async function fetchExistingDailyStructuredEntry(petId: string, category: DiaryCategory, entryDate: string) {
  const { data, error } = await supabase!
    .from("diary_entries")
    .select(diaryEntrySelect)
    .eq("pet_id", petId)
    .eq("category", category)
    .eq("entry_date", entryDate)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as DiaryRowWithMedia | null;
}

async function fetchDiaryEntries(petId: string, fromDateKey: string, toDateKey: string) {
  const { data, error } = await supabase!
    .from("diary_entries")
    .select(diaryEntrySelect)
    .eq("pet_id", petId)
    .gte("entry_date", fromDateKey)
    .lte("entry_date", toDateKey)
    .order("occurred_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as DiaryRowWithMedia[]).map(mapDiaryRow);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function addDays(date: Date, days: number) { const nextDate = new Date(date); nextDate.setDate(nextDate.getDate() + days); return nextDate; }

function normalizeScore(value: number | null): 1 | 2 | 3 | 4 | 5 | undefined {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) return value;
  return undefined;
}

export function upsertDiaryEntryInList<T extends { id: string }>(entries: T[] | undefined, entry: T) { return [entry, ...removeDiaryEntryFromList(entries, entry.id)]; }

function removeDiaryEntryFromCachedLists(queryClient: QueryClient, petId: string | null, id: string) {
  for (const [queryKey, current] of queryClient.getQueriesData<DiaryEntry[]>({ queryKey: ["diary"] })) {
    if (Array.isArray(current) && isDiaryListCacheForPet(queryKey, petId)) queryClient.setQueryData<DiaryEntry[]>(queryKey, removeDiaryEntryFromList(current, id));
  }
}

function upsertDiaryEntryInCachedLists(queryClient: QueryClient, petId: string | null, entry: DiaryEntry) {
  for (const [queryKey, current] of queryClient.getQueriesData<DiaryEntry[]>({ queryKey: ["diary"] })) {
    if (Array.isArray(current) && isDiaryListCacheForPet(queryKey, petId) && cacheIncludesEntryDate(queryKey, entry.entryDate)) queryClient.setQueryData<DiaryEntry[]>(queryKey, upsertDiaryEntryInList(current, entry));
  }
}

function isDiaryListCacheForPet(queryKey: QueryKey, petId: string | null) {
  return queryKey[0] === "diary" && (queryKey[1] === "date" || queryKey[1] === "range") && queryKey[2] === petId;
}

function cacheIncludesEntryDate(queryKey: QueryKey, entryDate: string) {
  if (queryKey[1] === "date") return queryKey[3] === entryDate;
  return typeof queryKey[3] === "string" && typeof queryKey[4] === "string" && queryKey[3] <= entryDate && entryDate <= queryKey[4];
}
