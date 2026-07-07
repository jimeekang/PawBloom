import { getLocalDateKey } from "../application/diaryRecords";
import type { DiaryEntry } from "../domain/diaryEntry";

export function buildSampleDiaryEntries(petId: string): DiaryEntry[] {
  const todayKey = getLocalDateKey();
  return [
    { id: "entry-ui-1", petId, category: "food", origin: "diary", entryDate: todayKey, occurredAt: "08:15", summary: "아침식사 반만 먹음" },
    { id: "entry-ui-2", petId, category: "water", origin: "diary", entryDate: todayKey, occurredAt: "10:40", summary: "평소보다 물 섭취량이 적음" },
    { id: "entry-ui-3", petId, category: "stool", origin: "diary", entryDate: todayKey, occurredAt: "18:20", summary: "대변 한 번 묽음" },
  ];
}
