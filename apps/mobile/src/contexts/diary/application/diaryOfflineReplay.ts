import { getLocalDateKey } from "../../../shared-kernel/date";
import { buildOfflineMutation, requireString, stringValue, toRecord, type BaseOfflineMutationInput } from "../../sync/application/offlineMutationPayload";
import { registerOfflineReplayHandler, type OfflineReplayResult } from "../../sync/application/offlineReplayPolicy";
import type { OfflineMutation } from "../../sync/domain/offlineMutation";
import type { DiaryCategory } from "../domain/diaryEntry";
import { defaultDiarySummary, encodeDiarySummary } from "./diarySummary";

export function buildDiaryInsertOfflineMutation(input: BaseOfflineMutationInput & { petId: string; userId: string; input: Record<string, unknown> }): OfflineMutation {
  return buildOfflineMutation({
    aggregate: "diary",
    operation: "insert",
    payload: { petId: input.petId, userId: input.userId, input: input.input },
    clientMutationId: input.clientMutationId,
    createdAt: input.createdAt,
  });
}

export function buildDiaryReplayInsertPayload(input: { petId: string; userId: string; clientMutationId: string; input: Record<string, unknown> }) {
  const category = normalizeDiaryCategory(input.input.category);
  const entryDate = stringValue(input.input.entryDate) ?? getLocalDateKey();
  return {
    pet_id: input.petId,
    created_by: input.userId,
    category,
    summary: encodeDiarySummary({ category, memo: stringValue(input.input.summary) ?? "", detail: input.input.detail as never }) || defaultDiarySummary(category),
    condition_score: category === "condition" ? normalizeConditionScore(input.input.conditionScore) : null,
    entry_date: entryDate,
    occurred_at: buildOccurredAt(entryDate, stringValue(input.input.occurredTime)),
    record_origin: input.input.origin === "checklist" ? "checklist" as const : "diary" as const,
    client_mutation_id: input.clientMutationId,
  };
}

async function replayDiaryInsert(mutation: OfflineMutation): Promise<OfflineReplayResult> {
  const { supabase } = await import("../../../shared-kernel/supabase/client");
  if (!supabase) throw new Error("Supabase client is not configured.");
  const payload = toRecord(mutation.payload);
  const insertPayload = buildDiaryReplayInsertPayload({
    petId: requireString(payload.petId, "diary replay pet id"),
    userId: requireString(payload.userId, "diary replay user id"),
    input: toRecord(payload.input),
    clientMutationId: mutation.clientMutationId,
  });
  const { error } = await supabase.from("diary_entries").insert(insertPayload);
  if (error && error.code !== "23505") throw new Error(error.message);
  return { status: "applied", reason: "diary insert replayed" };
}

registerOfflineReplayHandler("diary", "insert", replayDiaryInsert);

function normalizeDiaryCategory(value: unknown): DiaryCategory {
  return value === "food" || value === "water" || value === "walk" || value === "stool" || value === "condition" || value === "photo" ? value : "memo";
}

function normalizeConditionScore(value: unknown) {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 ? value : 3;
}

function buildOccurredAt(dateKey: string, time?: string) {
  const date = parseDateKey(dateKey);
  const timeMatch = time?.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) date.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
  return date.toISOString();
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}
