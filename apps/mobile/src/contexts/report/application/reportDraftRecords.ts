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
  medicationCompletedCount: number;
  medicationPendingCount: number;
  missingRecords: string[];
  timelineHighlights: string[];
  vetQuestions: string[];
  englishPreview: string;
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
  userId,
  entries,
  doses,
}: {
  activePetId: string;
  databaseMode: boolean;
  livePetId: string | null;
  userId: string | null;
  entries: DiaryEntry[];
  doses: DoseRecord[];
}) {
  const range = useMemo(() => getLast7DayReportRange(), []);
  const diaryQuery = useDiaryEntriesByDateRange(livePetId, range.fromDateKey, range.toDateKey, userId);
  const dosesQuery = useMedicationDosesByDateRange(livePetId, range.fromDateKey, range.toDateKey, userId);
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
  const medicationAttentionCount = doses.filter((dose) => shouldCountDoseInMedicationAttention(dose.status)).length;
  const medicationCompletedCount = doses.filter((dose) => dose.status === "completed").length;
  const medicationPendingCount = doses.filter((dose) => dose.status === "pending").length;
  const conditionTrend = {
    direction: getConditionTrendDirection(latest, previous),
    latestScore: latest,
    previousScore: previous,
  };

  return {
    hasRecords: entries.length > 0 || doses.length > 0,
    diaryCount: entries.length,
    medicationCount: doses.length,
    medicationAttentionCount,
    medicationCompletedCount,
    medicationPendingCount,
    missingRecords: createMissingRecords(entries, doses, latest),
    timelineHighlights: createTimelineHighlights(entries, doses),
    vetQuestions: createVetQuestions(entries, medicationAttentionCount, conditionTrend),
    englishPreview: createEnglishPreview(entries.length, doses.length, medicationAttentionCount, conditionTrend),
    conditionTrend,
  };
}

function shouldCountDoseInMedicationAttention(status: DoseStatus) {
  return status === "partial" || status === "skipped";
}

function createMissingRecords(entries: DiaryEntry[], doses: DoseRecord[], latestScore?: 1 | 2 | 3 | 4 | 5) {
  const categories = new Set(entries.map((entry) => entry.category));
  const missing: string[] = [];

  if (entries.length === 0) missing.push("No diary records were logged in this range.");
  if (!categories.has("food")) missing.push("No food or appetite diary record was logged.");
  if (!categories.has("water")) missing.push("No water intake diary record was logged.");
  if (!categories.has("stool")) missing.push("No stool diary record was logged.");
  if (!latestScore) missing.push("No condition score was recorded.");
  if (doses.length === 0) missing.push("No medication records were logged.");

  return missing.slice(0, 5);
}

function createTimelineHighlights(entries: DiaryEntry[], doses: DoseRecord[]) {
  const entryHighlights = entries.map((entry) => ({
    sortKey: `${entry.entryDate} ${entry.occurredAt}`,
    text: `${entry.entryDate} ${entry.occurredAt} - ${diaryCategoryLabel(entry.category)}: ${entry.summary}`,
  }));
  const doseHighlights = doses.map((dose) => ({
    sortKey: `medication ${dose.scheduledAt} ${dose.id}`,
    text: `${dose.scheduledAt} - Medication ${dose.medicationName}: ${doseStatusLabel(dose.status)}${dose.administeredAmount ? `, given ${dose.administeredAmount}` : ""}`,
  }));

  return [...entryHighlights, ...doseHighlights]
    .sort((left, right) => right.sortKey.localeCompare(left.sortKey))
    .slice(0, 5)
    .map((highlight) => highlight.text);
}

function createVetQuestions(
  entries: DiaryEntry[],
  medicationAttentionCount: number,
  conditionTrend: ReportDraftSummary["conditionTrend"],
) {
  const questions: string[] = [];
  const categories = new Set(entries.map((entry) => entry.category));

  if (medicationAttentionCount > 0) {
    questions.push("Were any partial or skipped medication records intentional, and should the clinic review the schedule?");
  }
  if (conditionTrend.direction === "declining") {
    questions.push("The latest condition score is lower than the previous score; what context should the clinic know?");
  }
  if (categories.has("food") || categories.has("water") || categories.has("stool")) {
    questions.push("Are appetite, water, or stool changes important to discuss at this visit?");
  }
  if (!conditionTrend.latestScore) {
    questions.push("Should a daily condition score be added before the next clinic visit?");
  }

  return (questions.length > 0 ? questions : ["Are there recent changes outside these records that the clinic should know about?"]).slice(0, 4);
}

function createEnglishPreview(
  diaryCount: number,
  medicationCount: number,
  medicationAttentionCount: number,
  conditionTrend: ReportDraftSummary["conditionTrend"],
) {
  if (diaryCount === 0 && medicationCount === 0) {
    return "Record-based 7-day preview: no diary or medication records are available yet. This is not a diagnosis; a veterinarian should make medical decisions.";
  }

  const attentionCopy =
    medicationAttentionCount > 0
      ? `${medicationAttentionCount} medication record(s) were partial or skipped.`
      : "No partial or skipped medication records were found.";
  const conditionCopy = conditionTrend.latestScore
    ? `Condition score movement: ${conditionScoreMovementCopy(conditionTrend)}.`
    : "No condition score was recorded.";

  return `Record-based 7-day preview: ${diaryCount} diary record(s) and ${medicationCount} medication record(s) were logged. ${attentionCopy} ${conditionCopy} This is not a diagnosis; a veterinarian should make medical decisions.`;
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

function conditionScoreMovementCopy(conditionTrend: ReportDraftSummary["conditionTrend"]) {
  const { latestScore, previousScore, direction } = conditionTrend;
  if (!latestScore) return "no score";
  if (!previousScore) return `${latestScore}/5 recorded`;
  if (direction === "improving") return `score increased from ${previousScore} to ${latestScore}`;
  if (direction === "declining") return `score decreased from ${previousScore} to ${latestScore}`;
  return `score stayed at ${latestScore}`;
}

function diaryCategoryLabel(category: DiaryEntry["category"]) {
  const labels: Record<DiaryEntry["category"], string> = {
    food: "Food",
    water: "Water",
    walk: "Walk",
    stool: "Stool",
    condition: "Condition",
    memo: "Memo",
    photo: "Photo",
  };
  return labels[category];
}

function doseStatusLabel(status: DoseStatus) {
  const labels: Record<DoseStatus, string> = {
    pending: "not given yet",
    completed: "full dose recorded",
    partial: "partial dose recorded",
    skipped: "skipped",
  };
  return labels[status];
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
