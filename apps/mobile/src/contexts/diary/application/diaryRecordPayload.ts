import type { CreateDiaryEntryInput, DiaryCategory } from "../domain/diaryEntry";
import { defaultDiarySummary, encodeDiarySummary } from "./diarySummary";

export type DiaryUpdateInput = CreateDiaryEntryInput & { id: string; occurredTime?: string };
export type DiaryUpdatePayload = { category: DiaryCategory; summary: string; condition_score: number | null; entry_date: string; updated_at: string; occurred_at?: string };

export function buildDiaryUpdatePayload(input: DiaryUpdateInput): DiaryUpdatePayload {
  const entryDate = input.entryDate ?? getLocalDateKey();
  const payload = { category: input.category, summary: encodeDiarySummary({ category: input.category, memo: input.summary, detail: input.detail }) || defaultDiarySummary(input.category), condition_score: input.category === "condition" ? input.conditionScore ?? 3 : null, entry_date: entryDate, updated_at: new Date().toISOString() };
  const occurredAt = buildOccurredAtForTime(entryDate, input.occurredTime);
  return occurredAt ? { ...payload, occurred_at: occurredAt } : payload;
}

export function isStructuredDailyCategory(category: DiaryCategory) {
  return category === "food" || category === "water" || category === "walk" || category === "stool" || category === "condition";
}

export function buildOccurredAt(dateKey: string) {
  const now = new Date();
  const occurredAt = parseDateKey(dateKey);
  occurredAt.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return occurredAt.toISOString();
}

export function buildOccurredAtForTime(dateKey: string, occurredTime?: string) {
  const timeMatch = occurredTime?.match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) return undefined;
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  if (hours > 23 || minutes > 59) return undefined;
  const occurredAt = parseDateKey(dateKey);
  occurredAt.setHours(hours, minutes, 0, 0);
  return occurredAt.toISOString();
}

function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}
