import type { CareMedicationSchedule } from "../../contexts/care/domain/carePlan";
import { t } from "../../i18n/translations";
import { formatDateKeyDisplay } from "../../shared-kernel/date";
import type { Language } from "../../shared-kernel/types";

export const CARE_SCHEDULE_PREVIEW_COUNT = 3;

export function schedulePeriodBadge(schedule: Pick<CareMedicationSchedule, "endsOn">, language: Language = "ko"): string | null {
  if (!schedule.endsOn) return null;
  const match = schedule.endsOn.match(/^\d{4}-\d{2}-\d{2}/);
  if (!match) return null;
  // Locale-formatted: the old bare "M/D" read as day/month to EN users.
  return t("care.scheduleUntil").replace("{date}", formatDateKeyDisplay(match[0], language));
}

export function partitionCareSchedules<S>(schedules: S[], expanded: boolean): { visible: S[]; hiddenCount: number } {
  if (expanded || schedules.length <= CARE_SCHEDULE_PREVIEW_COUNT) return { visible: schedules, hiddenCount: 0 };
  return {
    visible: schedules.slice(0, CARE_SCHEDULE_PREVIEW_COUNT),
    hiddenCount: schedules.length - CARE_SCHEDULE_PREVIEW_COUNT,
  };
}
