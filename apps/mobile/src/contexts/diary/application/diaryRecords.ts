import { type QueryClient, type QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../shared-kernel/supabase/client";
import type { Database } from "../../../shared-kernel/supabase/database.types";
import { uploadDiaryPhoto } from "../../media/application/mediaUpload";
import type { CreateDiaryEntryInput, DiaryCategory, DiaryDetailInput, DiaryEntry } from "../domain/diaryEntry";

type DiaryRow = Database["public"]["Tables"]["diary_entries"]["Row"];
type DiaryInsert = Database["public"]["Tables"]["diary_entries"]["Insert"];
type DiaryRowWithMedia = DiaryRow & { media_assets?: { id: string }[] | null };
type DiaryUpdatePayload = { category: DiaryCategory; summary: string; condition_score: number | null; entry_date: string; updated_at: string; occurred_at?: string };

const diaryEntrySelect = "id,pet_id,category,occurred_at,summary,condition_score,entry_date,created_by,client_mutation_id,created_at,updated_at,media_assets(id)";

export type UpdateDiaryEntryInput = CreateDiaryEntryInput & { id: string; occurredTime?: string };

export const diaryKeys = {
  date: (petId: string | null, dateKey: string) => ["diary", "date", petId, dateKey] as const,
  range: (petId: string | null, fromDateKey: string, toDateKey: string) => ["diary", "range", petId, fromDateKey, toDateKey] as const,
};

export function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
}

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
    entryDate: row.entry_date,
    occurredAt: formatTime(row.occurred_at),
    summary: decoded.summary,
    memo: decoded.memo,
    detail: decoded.detail,
    conditionScore: normalizeScore(row.condition_score),
    photoCount: row.media_assets?.length ?? 0,
  };
}

export function encodeDiarySummary(input: { category: DiaryCategory; memo?: string; detail?: DiaryDetailInput }) {
  const memo = input.memo?.trim() ?? "";
  return input.detail ? JSON.stringify({ version: 1, category: input.category, memo, detail: input.detail }) : memo;
}

export function decodeDiarySummary(value: string, fallbackCategory: DiaryCategory): { summary: string; memo?: string; detail?: DiaryDetailInput } {
  try {
    const parsed = JSON.parse(value) as { version?: number; memo?: string; detail?: DiaryDetailInput };
    return parsed.version === 1 && parsed.detail ? { summary: buildDetailSummary(parsed.detail, parsed.memo), memo: parsed.memo?.trim() || undefined, detail: parsed.detail } : { summary: value };
  } catch {
    return { summary: value || defaultSummary(fallbackCategory) };
  }
}

export function buildDiaryUpdatePayload(input: UpdateDiaryEntryInput): DiaryUpdatePayload {
  const entryDate = input.entryDate ?? getLocalDateKey();
  const payload = { category: input.category, summary: encodeDiarySummary({ category: input.category, memo: input.summary, detail: input.detail }) || defaultSummary(input.category), condition_score: input.category === "condition" ? input.conditionScore ?? 3 : null, entry_date: entryDate, updated_at: new Date().toISOString() };
  const occurredAt = buildOccurredAtForTime(entryDate, input.occurredTime);
  return occurredAt ? { ...payload, occurred_at: occurredAt } : payload;
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
      const payload: DiaryInsert = {
        pet_id: petId,
        created_by: userId,
        category: input.category,
        summary: encodeDiarySummary({ category: input.category, memo: input.summary, detail: input.detail }) || defaultSummary(input.category),
        condition_score: input.category === "condition" ? input.conditionScore ?? 3 : null,
        entry_date: entryDate,
        occurred_at: buildOccurredAtForTime(entryDate, input.occurredTime) ?? buildOccurredAt(entryDate),
      };

      const { data, error } = await supabase.from("diary_entries").insert(payload).select().single();
      if (error) throw new Error(error.message);

      for (const [index, photo] of (input.photos ?? []).entries()) {
        await uploadDiaryPhoto(supabase, userId, petId, data.id, photo, index + 1);
      }

      return mapDiaryRow({ ...data, media_assets: input.photos?.map((_, index) => ({ id: `${data.id}-${index}` })) ?? [] });
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

function defaultSummary(category: CreateDiaryEntryInput["category"]) {
  const labels: Record<CreateDiaryEntryInput["category"], string> = { food: "식사가 기록되었습니다.", water: "물 섭취가 기록되었습니다.", walk: "산책이 기록되었습니다.", stool: "배변이 기록되었습니다.", condition: "컨디션 체크가 기록되었습니다.", memo: "메모가 기록되었습니다.", photo: "사진이 기록되었습니다." };
  return labels[category];
}

function buildDetailSummary(detail: DiaryDetailInput, memo?: string) {
  return [detailSummary(detail), memo?.trim()].filter(Boolean).join(" · ");
}

function detailSummary(detail: DiaryDetailInput) {
  if (detail.category === "food") {
    const mealParts = (Object.entries(detail.meals) as [string, { offeredGrams?: string; eatenGrams?: string }][])
      .filter(([, meal]) => meal.offeredGrams || meal.eatenGrams)
      .map(([slot, meal]) => `${mealLabel(slot)} ${meal.eatenGrams || "-"}g/${meal.offeredGrams || "-"}g`);
    return [...mealParts, detail.appetite ? `식욕 ${appetiteLabel(detail.appetite)}` : ""].filter(Boolean).join(", ");
  }
  if (detail.category === "water") return [`물 ${detail.amountMl || "-"}ml`, detail.intakeLevel ? levelLabel(detail.intakeLevel) : ""].filter(Boolean).join(", ");
  if (detail.category === "walk") return [`산책 ${detail.durationMinutes || "-"}분`, detail.intensity ? intensityLabel(detail.intensity) : "", detail.observation].filter(Boolean).join(", ");
  if (detail.category === "stool") return [`배변 ${detail.count || "-"}회`, detail.consistency ? stoolLabel(detail.consistency) : "", detail.hasBloodOrMucus ? "혈변/점액 관찰" : ""].filter(Boolean).join(", ");
  if (detail.category === "condition") return [`에너지 ${detail.energyLevel ? levelLabel(detail.energyLevel) : "-"}`, detail.discomfortNote].filter(Boolean).join(", ");
  return "";
}

function mealLabel(slot: string) { return ({ breakfast: "아침", lunch: "점심", dinner: "저녁", snack: "간식" } as Record<string, string>)[slot] ?? slot; }
function appetiteLabel(value: string) { return ({ good: "좋음", normal: "보통", low: "적음", refused: "거부" } as Record<string, string>)[value] ?? value; }
function levelLabel(value: string) { return ({ less: "적음", normal: "정상", more: "많음" } as Record<string, string>)[value] ?? value; }
function intensityLabel(value: string) { return ({ low: "낮음", normal: "보통", high: "높음" } as Record<string, string>)[value] ?? value; }
function stoolLabel(value: string) { return ({ normal: "정상변", soft: "무른변", diarrhea: "설사", hard: "딱딱함" } as Record<string, string>)[value] ?? value; }

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function buildOccurredAt(dateKey: string) {
  const now = new Date();
  const occurredAt = parseDateKey(dateKey);
  occurredAt.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return occurredAt.toISOString();
}

function buildOccurredAtForTime(dateKey: string, occurredTime?: string) {
  const timeMatch = occurredTime?.match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) return undefined;
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  if (hours > 23 || minutes > 59) return undefined;
  const occurredAt = parseDateKey(dateKey);
  occurredAt.setHours(hours, minutes, 0, 0);
  return occurredAt.toISOString();
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
