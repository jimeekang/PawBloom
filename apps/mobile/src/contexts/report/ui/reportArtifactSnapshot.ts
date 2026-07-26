import type { VetReportPayload } from "../application/vetReportContract";
import type { ConditionTrendDirection, ReportTimelineItem } from "../application/reportDraftRecords";
import { t } from "../../../i18n/translations";

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
  timelineItems: ReportTimelineItem[];
};

export function createReportArtifactSnapshot(payload: VetReportPayload): ReportArtifactSnapshot {
  const scores = payload.entries
    .filter((entry): entry is typeof entry & { conditionScore: 1 | 2 | 3 | 4 | 5 } => isConditionScore(entry.conditionScore))
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
    .map((entry) => entry.conditionScore);
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

// Emits the same neutral ReportTimelineItem shape as the pre-generation draft
// summary, so both timelines render through reportDraftDisplay (0006 C4).
function createTimelineItems(payload: VetReportPayload): ReportTimelineItem[] {
  const entries = payload.entries.map((entry) => ({
    sortKey: entry.occurredAt,
    item: {
      kind: "diary" as const,
      ...splitIsoDateTime(entry.occurredAt),
      category: entry.category,
      summary: entry.summary,
      conditionScore: entry.conditionScore ?? undefined,
    },
  }));
  const doses = payload.medicationDoses.map((dose) => ({
    sortKey: dose.scheduledAt,
    item: {
      kind: "medication" as const,
      ...splitIsoDateTime(dose.scheduledAt),
      medicationName: dose.medicationName,
      status: dose.status,
      dosageLabel: dose.dosageLabel ?? undefined,
      administeredAmount: dose.administeredAmount ?? undefined,
      reactionNote: dose.reactionNote ?? undefined,
    },
  }));

  return [...entries, ...doses]
    .sort((left, right) => right.sortKey.localeCompare(left.sortKey))
    .map(({ item }) => item);
}

function splitIsoDateTime(value: string): { dateKey?: string; time: string } {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (match && match[1] && match[2]) return { dateKey: match[1], time: match[2] };
  return { time: value };
}

function formatPetDetails(payload: VetReportPayload) {
  if (!payload.pet) return t("reports.notRecorded");
  const notRecorded = t("reports.notRecorded");
  return [
    `${t("pet.nameLabel")}: ${payload.pet.name}`,
    `${t("pet.speciesLabel")}: ${speciesLabel(payload.pet.species)}`,
    `${t("pet.breedLabel")}: ${payload.pet.breed ?? notRecorded}`,
    `${t("reports.petWeight")}: ${payload.pet.weightKg != null ? `${payload.pet.weightKg}kg` : notRecorded}`,
  ].join(" · ");
}

function speciesLabel(species: string) {
  if (species === "dog") return t("pet.speciesDog");
  if (species === "cat") return t("pet.speciesCat");
  return species || t("pet.speciesOther");
}

function isConditionScore(value: number | null): value is 1 | 2 | 3 | 4 | 5 {
  return Number.isInteger(value) && value !== null && value >= 1 && value <= 5;
}

function conditionTrendDirection(latest?: 1 | 2 | 3 | 4 | 5, previous?: 1 | 2 | 3 | 4 | 5): ConditionTrendDirection {
  if (!latest) return "none";
  if (!previous || latest === previous) return "stable";
  return latest > previous ? "improving" : "declining";
}
