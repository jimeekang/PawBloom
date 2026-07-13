import type { TranslationKey } from "../../../i18n/translations";
import type { CareSetupInput } from "../domain/carePlan";

export type ShortTermMedicationDraft = {
  conditionName: string;
  medicationName: string;
  dosageLabel: string;
  times: string[];
  startsOn: string;
  endsOn: string;
};

export const SHORT_TERM_DEFAULT_DURATION_DAYS = 7;

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
}

export function createShortTermMedicationDraft(todayKey: string): ShortTermMedicationDraft {
  return {
    conditionName: "",
    medicationName: "",
    dosageLabel: "",
    times: ["08:00"],
    startsOn: todayKey,
    endsOn: addDaysToDateKey(todayKey, SHORT_TERM_DEFAULT_DURATION_DAYS),
  };
}

export function shortTermDraftErrorKey(draft: ShortTermMedicationDraft): TranslationKey | null {
  if (!draft.medicationName.trim()) return "care.quickDoseMedicationRequired";
  if (!draft.endsOn || draft.endsOn < draft.startsOn) return "care.shortTermPeriodInvalid";
  return null;
}

// id 필드를 채우지 않아야 영속 계층이 기존 스케줄을 수정하는 대신 새 약과 스케줄을 추가한다.
export function buildShortTermCareSetupInput(draft: ShortTermMedicationDraft): CareSetupInput {
  return {
    conditionName: draft.conditionName.trim(),
    planTitle: "",
    medicationName: draft.medicationName.trim(),
    dosageLabel: draft.dosageLabel.trim(),
    localTime: draft.times[0] ?? "08:00",
    localTimes: draft.times,
    startsOn: draft.startsOn,
    endsOn: draft.endsOn,
    recurrenceIntervalDays: 1,
  };
}
