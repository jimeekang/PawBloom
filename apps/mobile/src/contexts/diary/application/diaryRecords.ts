import { type QueryClient, type QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../shared-kernel/supabase/client";
import type { Database } from "../../../shared-kernel/supabase/database.types";
import { enqueueOfflineMutation } from "../../sync/application/offlineOutbox";
import { isRetriableOfflineError } from "../../sync/application/offlineErrorPolicy";
import { createUuid } from "../../../shared-kernel/uuid";
import { buildDiaryInsertOfflineMutation } from "./diaryOfflineReplay";
import { deleteDiaryEntryAtomic } from "./diaryDeletion";
import type { CreateDiaryEntryInput, DiaryCategory, DiaryEntry } from "../domain/diaryEntry";
import { inferDiaryRecordOrigin } from "./diaryRecordOrigin";
import { buildDiaryUpdatePayload, buildOccurredAt, buildOccurredAtForTime, isStructuredDailyCategory, type DiaryUpdateInput } from "./diaryRecordPayload";
import { diaryEntrySelect, fetchDiaryEntryByClientMutationId, fetchDiaryRowsWithPhotoUrls, fetchExistingDailyStructuredEntry, updateCanonicalStructuredEntry, type DiaryRowWithMedia } from "./diaryRecordQueries";
import { decodeDiarySummary, defaultDiarySummary, encodeDiarySummary } from "./diarySummary";
import { createPhotoDiaryEntryAtomic, updatePhotoDiaryEntryAtomic } from "./diaryPhotoRecords";
import { resolveDiaryUniqueConflict } from "./diaryUniqueConflict";

export { buildDiaryUpdatePayload } from "./diaryRecordPayload";
export { decodeDiarySummary, encodeDiarySummary } from "./diarySummary";

type DiaryRow = Database["public"]["Tables"]["diary_entries"]["Row"];
type DiaryInsert = Database["public"]["Tables"]["diary_entries"]["Insert"];

export { diaryEntrySelect } from "./diaryRecordQueries";

export type UpdateDiaryEntryInput = DiaryUpdateInput;
export type CreateDiaryEntryResult = { entry: DiaryEntry; queued: boolean };

export const diaryKeys = {
  date: (petId: string | null, dateKey: string, userId: string | null = null) => ["diary", "date", petId, dateKey, userId] as const,
  range: (petId: string | null, fromDateKey: string, toDateKey: string, userId: string | null = null) => ["diary", "range", petId, fromDateKey, toDateKey, userId] as const,
};

import { getLocalDateKey } from "../../../shared-kernel/date";

export { getLocalDateKey };

export function getWeekDateRange(dateKey: string) {
  const date = parseDateKey(dateKey), day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = addDays(date, mondayOffset);
  return { fromDateKey: getLocalDateKey(start), toDateKey: getLocalDateKey(addDays(start, 6)) };
}

export function mapDiaryRow(row: DiaryRowWithMedia, photoUrls: string[] = []): DiaryEntry {
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
    photoUrls,
  };
}

export function removeDiaryEntryFromList<T extends { id: string }>(entries: T[] | undefined, id: string) {
  return (entries ?? []).filter((entry) => entry.id !== id);
}

export function useDiaryEntriesByDate(petId: string | null, dateKey: string, userId: string | null = null) {
  return useQuery({
    queryKey: diaryKeys.date(petId, dateKey, userId),
    enabled: Boolean(supabase && petId && userId && dateKey),
    queryFn: async () => (!supabase || !petId ? [] : fetchDiaryEntries(petId, dateKey, dateKey)),
  });
}

export function useDiaryEntriesByDateRange(petId: string | null, fromDateKey: string, toDateKey: string, userId: string | null = null) {
  return useQuery({
    queryKey: diaryKeys.range(petId, fromDateKey, toDateKey, userId),
    enabled: Boolean(supabase && petId && userId && fromDateKey && toDateKey),
    queryFn: async () => (!supabase || !petId ? [] : fetchDiaryEntries(petId, fromDateKey, toDateKey)),
  });
}

export function useTodayDiaryEntries(petId: string | null, userId: string | null = null) { return useDiaryEntriesByDate(petId, getLocalDateKey(), userId); }

export function useUpdateDiaryEntry(petId: string | null, userId: string | null = null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateDiaryEntryInput) => {
      if (!supabase || !petId) throw new Error("로그인이 필요합니다.");
      if (input.category === "photo") {
        if (!userId || !input.clientMutationId) throw new Error("사진 수정 식별자를 만들지 못했습니다.");
        if ((input.photos?.length ?? 0) > 5) throw new Error("하루 사진은 최대 5장까지 저장할 수 있습니다.");
        return mapDiaryRow(await updatePhotoDiaryEntryAtomic({
          client: supabase,
          petId,
          input,
          entryId: input.id,
          appendMutationId: input.clientMutationId,
        }));
      }
      const { data, error } = await supabase.from("diary_entries").update(buildDiaryUpdatePayload(input)).eq("id", input.id).eq("pet_id", petId).is("superseded_by", null).select(diaryEntrySelect).single();
      if (error) throw new Error(error.message);
      return mapDiaryRow(data as DiaryRowWithMedia);
    },
    onSuccess: (entry) => {
      removeDiaryEntryFromCachedLists(queryClient, petId, userId, entry.id);
      upsertDiaryEntryInCachedLists(queryClient, petId, userId, entry);
      void queryClient.invalidateQueries({ queryKey: ["diary"] });
    },
  });
}

export function useDeleteDiaryEntry(petId: string | null, userId: string | null = null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase || !petId) throw new Error("로그인이 필요합니다.");
      const deleted = await deleteDiaryEntryAtomic(supabase, petId, id);
      return { id, entry: deleted ? mapDiaryRow(deleted) : null };
    },
    onSuccess: (result) => {
      removeDiaryEntryFromCachedLists(queryClient, petId, userId, result.id);
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
      const clientMutationId = input.clientMutationId ?? createUuid();
      if (input.category === "photo") {
        if (!input.photos?.length) throw new Error("저장할 사진을 한 장 이상 선택해 주세요.");
        return { entry: mapDiaryRow(await createPhotoDiaryEntryAtomic({ client: supabase, petId, input: { ...input, entryDate }, entryId: clientMutationId, clientMutationId })), queued: false };
      }
      if (input.photos?.length) throw new Error("사진은 사진 카테고리에서만 저장할 수 있습니다.");
      const existingEntry = isStructuredDailyCategory(input.category) ? await fetchExistingDailyStructuredEntry(petId, input.category, entryDate) : null;
      if (existingEntry) {
        if (input.origin === "checklist") return { entry: mapDiaryRow(existingEntry), queued: false };
        return { entry: mapDiaryRow(await updateCanonicalStructuredEntry(petId, existingEntry.id, input, entryDate)), queued: false };
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
        client_mutation_id: clientMutationId,
      };

      let insertResult;
      try {
        insertResult = await supabase.from("diary_entries").insert(payload).select(diaryEntrySelect).single();
      } catch (error) {
        if (!isRetriableOfflineError(error)) throw error;
        await enqueueOfflineMutation(buildDiaryInsertOfflineMutation({ petId, userId, input: input as unknown as Record<string, unknown>, clientMutationId }));
        return { entry: mapQueuedDiaryEntry(payload, clientMutationId), queued: true };
      }
      const { data, error } = insertResult;
      if (error) {
        if (error.code === "23505") {
          const mutationMatch = await fetchDiaryEntryByClientMutationId(petId, clientMutationId);
          const canonical = !mutationMatch && isStructuredDailyCategory(input.category)
            ? await fetchExistingDailyStructuredEntry(petId, input.category, entryDate)
            : null;
          const action = resolveDiaryUniqueConflict({
            category: input.category,
            origin: input.origin === "checklist" ? "checklist" : "diary",
            hasClientMutationMatch: Boolean(mutationMatch),
            hasCanonical: Boolean(canonical),
          });
          if (action === "already-applied" && mutationMatch) return { entry: mapDiaryRow(mutationMatch), queued: false };
          if (action === "keep-canonical" && canonical) return { entry: mapDiaryRow(canonical), queued: false };
          if (action === "update-canonical" && canonical) {
            return { entry: mapDiaryRow(await updateCanonicalStructuredEntry(petId, canonical.id, input, entryDate)), queued: false };
          }
        }
        if (isRetriableOfflineError(error)) {
          await enqueueOfflineMutation(buildDiaryInsertOfflineMutation({ petId, userId, input: input as unknown as Record<string, unknown>, clientMutationId }));
          return { entry: mapQueuedDiaryEntry(payload, clientMutationId), queued: true };
        }
        throw new Error(error.message);
      }

      return { entry: mapDiaryRow({ ...data, media_assets: [] } as DiaryRowWithMedia), queued: false };
    },
    onSuccess: (result) => {
      upsertDiaryEntryInCachedLists(queryClient, petId, userId, result.entry);
      if (!result.queued) void queryClient.invalidateQueries({ queryKey: ["diary"] });
    },
  });
}

function mapQueuedDiaryEntry(payload: DiaryInsert, clientMutationId: string) {
  const queuedAt = new Date().toISOString();
  return mapDiaryRow({
    ...payload,
    id: clientMutationId,
    client_mutation_id: clientMutationId,
    created_at: queuedAt,
    updated_at: queuedAt,
    superseded_by: null,
    media_assets: [],
  } as DiaryRowWithMedia);
}

async function fetchDiaryEntries(petId: string, fromDateKey: string, toDateKey: string) {
  const rowsWithPhotos = await fetchDiaryRowsWithPhotoUrls(petId, fromDateKey, toDateKey);
  return rowsWithPhotos.map(({ row, photoUrls }) => mapDiaryRow(row, photoUrls));
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

function removeDiaryEntryFromCachedLists(queryClient: QueryClient, petId: string | null, userId: string | null, id: string) {
  for (const [queryKey, current] of queryClient.getQueriesData<DiaryEntry[]>({ queryKey: ["diary"] })) {
    if (Array.isArray(current) && isDiaryListCacheForPet(queryKey, petId, userId)) queryClient.setQueryData<DiaryEntry[]>(queryKey, removeDiaryEntryFromList(current, id));
  }
}

function upsertDiaryEntryInCachedLists(queryClient: QueryClient, petId: string | null, userId: string | null, entry: DiaryEntry) {
  for (const [queryKey, current] of queryClient.getQueriesData<DiaryEntry[]>({ queryKey: ["diary"] })) {
    if (Array.isArray(current) && isDiaryListCacheForPet(queryKey, petId, userId) && cacheIncludesEntryDate(queryKey, entry.entryDate)) queryClient.setQueryData<DiaryEntry[]>(queryKey, upsertDiaryEntryInList(current, entry));
  }
}

function isDiaryListCacheForPet(queryKey: QueryKey, petId: string | null, userId: string | null) {
  return queryKey[0] === "diary" && (queryKey[1] === "date" || queryKey[1] === "range") && queryKey[2] === petId && queryKey.at(-1) === userId;
}

function cacheIncludesEntryDate(queryKey: QueryKey, entryDate: string) {
  if (queryKey[1] === "date") return queryKey[3] === entryDate;
  return typeof queryKey[3] === "string" && typeof queryKey[4] === "string" && queryKey[3] <= entryDate && entryDate <= queryKey[4];
}
