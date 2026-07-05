import { defaultDiarySummary, encodeDiarySummary } from "../../diary/application/diarySummary";
import type { DiaryCategory } from "../../diary/domain/diaryEntry";
import { buildDoseRecordedAt, encodeMedicationDoseCareNote } from "../../medication/application/medicationDosePayload";
import type { DoseStatus } from "../../medication/domain/medication";
import type { OfflineMutation } from "../domain/offlineMutation";

type BaseOfflineMutationInput = {
  clientMutationId?: string;
  createdAt?: string;
};

export function buildDiaryInsertOfflineMutation(input: BaseOfflineMutationInput & { petId: string; userId: string; input: Record<string, unknown> }): OfflineMutation {
  const clientMutationId = input.clientMutationId ?? createClientMutationId();
  return {
    id: `offline-${clientMutationId}`,
    clientMutationId,
    aggregate: "diary",
    operation: "insert",
    payload: { petId: input.petId, userId: input.userId, input: input.input },
    createdAt: input.createdAt ?? new Date().toISOString(),
    attempts: 0,
  };
}

export function buildMedicationDoseUpdateOfflineMutation(input: BaseOfflineMutationInput & { petId: string; input: Record<string, unknown> }): OfflineMutation {
  const clientMutationId = input.clientMutationId ?? createClientMutationId();
  return {
    id: `offline-${clientMutationId}`,
    clientMutationId,
    aggregate: "medication",
    operation: "update",
    payload: { petId: input.petId, input: input.input },
    createdAt: input.createdAt ?? new Date().toISOString(),
    attempts: 0,
  };
}

export function buildDiaryReplayInsertPayload(input: { petId: string; userId: string; clientMutationId: string; input: Record<string, unknown> }) {
  const category = normalizeDiaryCategory(input.input.category);
  const entryDate = stringValue(input.input.entryDate) ?? localDateKey();
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

export function buildMedicationDoseReplayUpdatePayload(input: { clientMutationId: string; input: Record<string, unknown> }) {
  const status = normalizeDoseStatus(input.input.status);
  return {
    medication_name: stringValue(input.input.medicationName)?.trim() || "투약",
    reaction_note: encodeMedicationDoseCareNote(input.input),
    status,
    recorded_at: status ? buildDoseRecordedAt(status) : undefined,
    client_mutation_id: input.clientMutationId,
    updated_at: new Date().toISOString(),
  };
}

function createClientMutationId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeDiaryCategory(value: unknown): DiaryCategory {
  return value === "food" || value === "water" || value === "walk" || value === "stool" || value === "condition" || value === "photo" ? value : "memo";
}

function normalizeConditionScore(value: unknown) {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 ? value : 3;
}

function normalizeDoseStatus(value: unknown): DoseStatus | undefined {
  return value === "pending" || value === "completed" || value === "skipped" || value === "partial" ? value : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function buildOccurredAt(dateKey: string, time?: string) {
  const date = parseDateKey(dateKey);
  const timeMatch = time?.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) date.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
  return date.toISOString();
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}
