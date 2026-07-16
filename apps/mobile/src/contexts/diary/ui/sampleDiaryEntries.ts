import { getLocalDateKey } from "../application/diaryRecords";
import type { DiaryEntry } from "../domain/diaryEntry";
import type { Language } from "../../../shared-kernel/types";

const summaries: Record<Language, [string, string, string]> = {
  en: ["Ate half of breakfast", "Drank less water than usual", "One loose stool"],
  ko: ["아침식사 반만 먹음", "평소보다 물 섭취량이 적음", "대변 한 번 묽음"],
};

export function buildSampleDiaryEntries(petId: string, language: Language = "ko"): DiaryEntry[] {
  const todayKey = getLocalDateKey();
  const [food, water, stool] = summaries[language];
  return [
    { id: "entry-ui-1", petId, category: "food", origin: "diary", entryDate: todayKey, occurredAt: "08:15", summary: food },
    { id: "entry-ui-2", petId, category: "water", origin: "diary", entryDate: todayKey, occurredAt: "10:40", summary: water },
    { id: "entry-ui-3", petId, category: "stool", origin: "diary", entryDate: todayKey, occurredAt: "18:20", summary: stool },
  ];
}

export function relocalizeSampleDiaryEntries(entries: DiaryEntry[], language: Language): DiaryEntry[] {
  const targetSummaries = sampleSummaryById(language);
  const knownSummaries = [sampleSummaryById("ko"), sampleSummaryById("en")];
  return entries.map((entry) => {
    const target = targetSummaries.get(entry.id);
    const isUntouchedSample = knownSummaries.some((summariesById) => summariesById.get(entry.id) === entry.summary);
    return target && isUntouchedSample ? { ...entry, summary: target } : entry;
  });
}

function sampleSummaryById(language: Language) {
  const [food, water, stool] = summaries[language];
  return new Map([
    ["entry-ui-1", food],
    ["entry-ui-2", water],
    ["entry-ui-3", stool],
  ]);
}
