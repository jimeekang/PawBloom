import type { DiaryEntry } from "../domain/diaryEntry";
import { pendingRecordMutations } from "../../sync/application/pendingRecordMutations";
import { toRecord } from "../../sync/application/offlineMutationPayload";
import { buildDiaryReplayInsertPayload } from "./diaryOfflineReplay";
import { decodeDiarySummary } from "./diarySummary";
import { isStructuredDailyCategory } from "./diaryRecordPayload";
/** Refetches merge the existing durable outbox until replay removes or reconciles its record. */
export async function overlayPendingDiaryEntries(server: DiaryEntry[], clientMutationIds: readonly (string | null)[], petId: string, userId: string | null | undefined, fromDateKey: string, toDateKey: string) {
  let rows = server;
  const applied = new Set(clientMutationIds);
  for (const mutation of await pendingRecordMutations(userId, petId, "diary")) {
    if (mutation.operation !== "insert" || applied.has(mutation.clientMutationId)) continue;
    const payload = buildDiaryReplayInsertPayload({ petId, userId: userId!, clientMutationId: mutation.clientMutationId, input: toRecord(mutation.payload.input), queuedAt: mutation.createdAt });
    if (payload.entry_date < fromDateKey || payload.entry_date > toDateKey) continue;
    const summary = decodeDiarySummary(payload.summary, payload.category);
    const entry: DiaryEntry = { id: mutation.id, petId, category: payload.category, origin: payload.record_origin, entryDate: payload.entry_date, occurredAt: new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(payload.occurred_at)), ...summary, conditionScore: (payload.condition_score ?? undefined) as DiaryEntry["conditionScore"], photoCount: 0, photoUrls: [] };
    const sameDaily = (item: DiaryEntry) => isStructuredDailyCategory(entry.category) && item.category === entry.category && item.entryDate === entry.entryDate;
    if (entry.origin === "checklist" && rows.some(sameDaily)) continue;
    rows = [entry, ...rows.filter((item) => item.id !== entry.id && !sameDaily(item))];
  }
  return rows.filter((entry) => entry.petId === petId && entry.entryDate >= fromDateKey && entry.entryDate <= toDateKey);
}
