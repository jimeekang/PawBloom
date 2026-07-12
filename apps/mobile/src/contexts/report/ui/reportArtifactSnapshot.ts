import type { VetReportPayload } from "../application/vetReportContract";
import type { ConditionTrendDirection } from "../application/reportDraftRecords";

export type ReportArtifactSnapshot = {
  hasRecords: boolean;
  diaryCount: number;
  medicationCount: number;
  medicationAttentionCount: number;
  medicationCompletedCount: number;
  medicationPendingCount: number;
  conditionTrend: {
    direction: ConditionTrendDirection;
    latestScore?: 1 | 2 | 3 | 4 | 5;
    previousScore?: 1 | 2 | 3 | 4 | 5;
  };
  petDetails: string;
  timelineItems: string[];
};

export function createReportArtifactSnapshot(payload: VetReportPayload): ReportArtifactSnapshot {
  const scores = payload.entries
    .filter((entry): entry is typeof entry & { condition_score: 1 | 2 | 3 | 4 | 5 } => isConditionScore(entry.condition_score))
    .sort((left, right) => left.occurred_at.localeCompare(right.occurred_at))
    .map((entry) => entry.condition_score);
  const latestScore = scores.at(-1);
  const previousScore = scores.at(-2);
  const medicationAttentionCount = payload.medicationDoses.filter((dose) => dose.status === "partial" || dose.status === "skipped").length;

  return {
    hasRecords: payload.entries.length > 0 || payload.medicationDoses.length > 0,
    diaryCount: payload.entries.length,
    medicationCount: payload.medicationDoses.length,
    medicationAttentionCount,
    medicationCompletedCount: payload.medicationDoses.filter((dose) => dose.status === "completed").length,
    medicationPendingCount: payload.medicationDoses.filter((dose) => dose.status === "pending").length,
    conditionTrend: {
      direction: conditionTrendDirection(latestScore, previousScore),
      latestScore,
      previousScore,
    },
    petDetails: formatPetDetails(payload),
    timelineItems: createTimelineItems(payload),
  };
}

function createTimelineItems(payload: VetReportPayload) {
  const entries = payload.entries.map((entry) => ({
    sortKey: entry.occurred_at,
    text: `${entry.occurred_at} · ${entry.category} · ${entry.summary} · condition_score: ${entry.condition_score ?? "null"}`,
  }));
  const doses = payload.medicationDoses.map((dose) => ({
    sortKey: dose.scheduled_at,
    text: `${dose.scheduled_at} · ${dose.medication_name} · ${dose.status} · reaction_note: ${dose.reaction_note ?? "null"}`,
  }));

  return [...entries, ...doses]
    .sort((left, right) => right.sortKey.localeCompare(left.sortKey))
    .map((item) => item.text);
}

function formatPetDetails(payload: VetReportPayload) {
  if (!payload.pet) return "pet: null";
  return [
    `name: ${payload.pet.name}`,
    `species: ${payload.pet.species}`,
    `breed: ${payload.pet.breed ?? "null"}`,
    `weight_kg: ${payload.pet.weight_kg ?? "null"}`,
  ].join(" · ");
}

function isConditionScore(value: number | null): value is 1 | 2 | 3 | 4 | 5 {
  return Number.isInteger(value) && value !== null && value >= 1 && value <= 5;
}

function conditionTrendDirection(latest?: 1 | 2 | 3 | 4 | 5, previous?: 1 | 2 | 3 | 4 | 5): ConditionTrendDirection {
  if (!latest) return "none";
  if (!previous || latest === previous) return "stable";
  return latest > previous ? "improving" : "declining";
}
