import { getLocalDateKey } from "../../../shared-kernel/date";
import { buildOfflineMutation, requireString, stringValue, toRecord, type BaseOfflineMutationInput } from "../../sync/application/offlineMutationPayload";
import { registerOfflineReplayHandler, type OfflineReplayResult } from "../../sync/application/offlineReplayPolicy";
import type { OfflineMutation } from "../../sync/domain/offlineMutation";
import type { DiaryCategory } from "../domain/diaryEntry";
import { isStructuredDailyCategory } from "./diaryRecordPayload";
import { defaultDiarySummary, encodeDiarySummary } from "./diarySummary";
import { resolveDiaryUniqueConflict, shouldApplyDiaryReplayOverCanonical } from "./diaryUniqueConflict";

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
  if (!error) return { status: "applied", reason: "diary insert replayed" };
  if (error.code !== "23505") throw new Error(error.message);

  const mutationMatch = await findReplayEntryByClientMutationId(insertPayload.pet_id, insertPayload.client_mutation_id);
  const canonical = !mutationMatch && isStructuredDailyCategory(insertPayload.category)
    ? await findReplayCanonicalEntry(insertPayload.pet_id, insertPayload.category, insertPayload.entry_date)
    : null;
  const action = resolveDiaryUniqueConflict({
    category: insertPayload.category,
    origin: insertPayload.record_origin,
    hasClientMutationMatch: Boolean(mutationMatch),
    hasCanonical: Boolean(canonical),
  });

  if (action === "already-applied") return { status: "applied", reason: "diary insert was already replayed" };
  if (action === "keep-canonical") return { status: "applied", reason: "checklist replay kept the existing daily diary record" };
  if (action === "update-canonical" && canonical) {
    if (!shouldApplyDiaryReplayOverCanonical(mutation.createdAt, canonical.updated_at)) {
      return { status: "conflict", reason: "newer canonical diary content was kept" };
    }
    const { data: updated, error: updateError } = await supabase
      .from("diary_entries")
      .update(buildDiaryReplayCanonicalUpdatePayload(insertPayload, mutation.createdAt))
      .eq("id", canonical.id)
      .eq("pet_id", insertPayload.pet_id)
      .is("superseded_by", null)
      .lte("updated_at", mutation.createdAt)
      .select("id")
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (!updated) return { status: "conflict", reason: "canonical diary content changed during replay and was kept" };
    return { status: "applied", reason: "offline diary reconciled the active daily record" };
  }

  return { status: "conflict", reason: "diary insert conflicts with an unrelated unique record" };
}

registerOfflineReplayHandler("diary", "insert", replayDiaryInsert);

type DiaryReplayInsertPayload = ReturnType<typeof buildDiaryReplayInsertPayload>;

export function buildDiaryReplayCanonicalUpdatePayload(payload: DiaryReplayInsertPayload, updatedAt = new Date().toISOString()) {
  return {
    summary: payload.summary,
    condition_score: payload.condition_score,
    occurred_at: payload.occurred_at,
    record_origin: "diary" as const,
    updated_at: updatedAt,
  };
}

async function findReplayEntryByClientMutationId(petId: string, clientMutationId: string) {
  const { supabase } = await import("../../../shared-kernel/supabase/client");
  const { data, error } = await supabase!
    .from("diary_entries")
    .select("id")
    .eq("pet_id", petId)
    .eq("client_mutation_id", clientMutationId)
    .is("superseded_by", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function findReplayCanonicalEntry(petId: string, category: DiaryCategory, entryDate: string) {
  const { supabase } = await import("../../../shared-kernel/supabase/client");
  const { data, error } = await supabase!
    .from("diary_entries")
    .select("id,updated_at")
    .eq("pet_id", petId)
    .eq("category", category)
    .eq("entry_date", entryDate)
    .is("superseded_by", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

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
