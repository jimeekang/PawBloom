import { useMemo } from "react";
import type { DiaryEntry } from "../../diary/domain/diaryEntry";
import { useDiaryEntriesByDateRange } from "../../diary/application/diaryRecords";
import { useMedicationDosesByDateRange } from "../../medication/application/medicationDoseRecords";
import type { DoseRecord, DoseStatus } from "../../medication/domain/medication";

export type ReportDateRange = {
  fromDateKey: string;
  toDateKey: string;
};

export type ConditionTrendDirection = "none" | "stable" | "improving" | "declining";

export type ReportDraftSummary = {
  hasRecords: boolean;
  diaryCount: number;
  medicationCount: number;
  medicationAttentionCount: number;
  conditionTrend: {
    direction: ConditionTrendDirection;
    latestScore?: 1 | 2 | 3 | 4 | 5;
    previousScore?: 1 | 2 | 3 | 4 | 5;
  };
};

export function useReportDraftSummary({
  activePetId,
  databaseMode,
  livePetId,
  entries,
  doses,
}: {
  activePetId: string;
  databaseMode: boolean;
  livePetId: string | null;
  entries: DiaryEntry[];
  doses: DoseRecord[];
}) {
  const range = useMemo(() => getLast7DayReportRange(), []);
  const diaryQuery = useDiaryEntriesByDateRange(livePetId, range.fromDateKey, range.toDateKey);
  const dosesQuery = useMedicationDosesByDateRange(livePetId, range.fromDateKey, range.toDateKey);
  return useMemo(() => {
    const reportEntries = databaseMode
      ? diaryQuery.data ?? []
      : entries.filter((entry) => entry.petId === activePetId && entry.entryDate >= range.fromDateKey && entry.entryDate <= range.toDateKey);
    const reportDoses = databaseMode ? dosesQuery.data ?? [] : doses.filter((dose) => dose.petId === activePetId);
    return createReportDraftSummary(reportEntries, reportDoses);
  }, [activePetId, databaseMode, diaryQuery.data, doses, dosesQuery.data, entries, range.fromDateKey, range.toDateKey]);
}

export function getLast7DayReportRange(anchorDate = new Date()): ReportDateRange {
  const toDate = new Date(anchorDate);
  toDate.setHours(0, 0, 0, 0);
  const fromDate = addDays(toDate, -6);

  return {
    fromDateKey: getLocalDateKey(fromDate),
    toDateKey: getLocalDateKey(toDate),
  };
}

export function createReportDraftSummary(entries: DiaryEntry[], doses: DoseRecord[]): ReportDraftSummary {
  const scoreEntries = entries
    .filter((entry) => entry.category === "condition" && entry.conditionScore)
    .sort((left, right) => compareDiaryEntryTime(left, right));
  const latest = scoreEntries.at(-1)?.conditionScore;
  const previous = scoreEntries.at(-2)?.conditionScore;

  return {
    hasRecords: entries.length > 0 || doses.length > 0,
    diaryCount: entries.length,
    medicationCount: doses.length,
    medicationAttentionCount: doses.filter((dose) => shouldCountDoseInMedicationAttention(dose.status)).length,
    conditionTrend: {
      direction: getConditionTrendDirection(latest, previous),
      latestScore: latest,
      previousScore: previous,
    },
  };
}

function shouldCountDoseInMedicationAttention(status: DoseStatus) {
  return status === "partial" || status === "skipped";
}

function getConditionTrendDirection(latest?: 1 | 2 | 3 | 4 | 5, previous?: 1 | 2 | 3 | 4 | 5): ConditionTrendDirection {
  if (!latest) {
    return "none";
  }
  if (!previous || latest === previous) {
    return "stable";
  }
  return latest > previous ? "improving" : "declining";
}

function compareDiaryEntryTime(left: DiaryEntry, right: DiaryEntry) {
  const leftKey = `${left.entryDate} ${left.occurredAt}`;
  const rightKey = `${right.entryDate} ${right.occurredAt}`;
  return leftKey.localeCompare(rightKey);
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}
