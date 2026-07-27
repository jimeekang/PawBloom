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

// The summary stays language-neutral (application must not import i18n);
// report/ui/reportDraftDisplay.ts turns these kinds/items into copy.
export type ReportMissingKind = "noDiary" | "noFood" | "noWater" | "noStool" | "noScore" | "noMedication";
export type ReportVetQuestionKind = "medication" | "declining" | "intake" | "noScore" | "fallback";
export type ReportTimelineItem = {
  kind: "diary" | "medication";
  dateKey?: string;
  time: string;
  category?: DiaryEntry["category"];
  // summary is the stored fallback text (memo or legacy rows). Structured
  // entries also carry detail/memo so the ui layer can rebuild the sentence in
  // the reader's language instead of replaying the writer's.
  summary?: string;
  detail?: DiaryEntry["detail"];
  memo?: string;
  conditionScore?: number;
  medicationName?: string;
  status?: DoseStatus;
  dosageLabel?: string;
  administeredAmount?: string;
  reactionNote?: string;
};

export type ReportDraftSummary = {
  hasRecords: boolean;
  diaryCount: number;
  medicationCount: number;
  medicationAttentionCount: number;
  medicationCompletedCount: number;
  medicationPendingCount: number;
  missingRecords: ReportMissingKind[];
  timelineHighlights: ReportTimelineItem[];
  vetQuestions: ReportVetQuestionKind[];
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
  const summary = useMemo(() => {
    const reportEntries = databaseMode
      ? diaryQuery.data ?? []
      : entries.filter((entry) => entry.petId === activePetId && entry.entryDate >= range.fromDateKey && entry.entryDate <= range.toDateKey);
    const reportDoses = databaseMode ? dosesQuery.data ?? [] : doses.filter((dose) => dose.petId === activePetId);
    return createReportDraftSummary(reportEntries, reportDoses);
  }, [activePetId, databaseMode, diaryQuery.data, doses, dosesQuery.data, entries, range.fromDateKey, range.toDateKey]);

  // Source-query status: a failed 7-day fetch must render as an error with a
  // retry, not as the "no records in the last 7 days" empty state.
  const sourceStatus: "ready" | "loading" | "error" = !databaseMode
    ? "ready"
    : diaryQuery.isError || dosesQuery.isError
      ? "error"
      : diaryQuery.isLoading || dosesQuery.isLoading
        ? "loading"
        : "ready";
  const refetchSources = () => {
    void diaryQuery.refetch();
    void dosesQuery.refetch();
  };

  return { ...summary, sourceStatus, refetchSources };
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
  const missing: ReportMissingKind[] = [];

  if (entries.length === 0) missing.push("noDiary");
  if (!categories.has("food")) missing.push("noFood");
  if (!categories.has("water")) missing.push("noWater");
  if (!categories.has("stool")) missing.push("noStool");
  if (!latestScore) missing.push("noScore");
  if (doses.length === 0) missing.push("noMedication");

  return missing.slice(0, 5);
}

// Both record kinds sort on the same "date time" key so the newest item wins
// regardless of type (the old "medication ..." prefix pinned doses on top).
function createTimelineHighlights(entries: DiaryEntry[], doses: DoseRecord[]) {
  const entryHighlights = entries.map((entry) => ({
    sortKey: `${entry.entryDate} ${entry.occurredAt}`,
    item: { kind: "diary" as const, dateKey: entry.entryDate, time: entry.occurredAt, category: entry.category, summary: entry.summary, detail: entry.detail, memo: entry.memo },
  }));
  const doseHighlights = doses.map((dose) => ({
    sortKey: `${dose.doseDate ?? ""} ${dose.scheduledAt}`,
    item: { kind: "medication" as const, dateKey: dose.doseDate, time: dose.scheduledAt, medicationName: dose.medicationName, status: dose.status, administeredAmount: dose.administeredAmount },
  }));

  return [...entryHighlights, ...doseHighlights]
    .sort((left, right) => right.sortKey.localeCompare(left.sortKey))
    .slice(0, 5)
    .map((highlight) => highlight.item);
}

function createVetQuestions(
  entries: DiaryEntry[],
  medicationAttentionCount: number,
  conditionTrend: ReportDraftSummary["conditionTrend"],
) {
  const questions: ReportVetQuestionKind[] = [];
  const categories = new Set(entries.map((entry) => entry.category));

  if (medicationAttentionCount > 0) {
    questions.push("medication");
  }
  if (conditionTrend.direction === "declining") {
    questions.push("declining");
  }
  if (categories.has("food") || categories.has("water") || categories.has("stool")) {
    questions.push("intake");
  }
  if (!conditionTrend.latestScore) {
    questions.push("noScore");
  }

  return (questions.length > 0 ? questions : ["fallback" as const]).slice(0, 4);
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
