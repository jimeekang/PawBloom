import type { CareMedicationSchedule } from "../../contexts/care/domain/carePlan";
import { t } from "../../i18n/translations";

export const CARE_SCHEDULE_PREVIEW_COUNT = 3;

export function schedulePeriodBadge(schedule: Pick<CareMedicationSchedule, "endsOn">): string | null {
  if (!schedule.endsOn) return null;
  const match = schedule.endsOn.match(/^\d{4}-(\d{2})-(\d{2})/);
  if (!match) return null;
  return t("ko", "care.scheduleUntil").replace("{date}", `${Number(match[1])}/${Number(match[2])}`);
}

export function partitionCareSchedules<S>(schedules: S[], expanded: boolean): { visible: S[]; hiddenCount: number } {
  if (expanded || schedules.length <= CARE_SCHEDULE_PREVIEW_COUNT) return { visible: schedules, hiddenCount: 0 };
  return {
    visible: schedules.slice(0, CARE_SCHEDULE_PREVIEW_COUNT),
    hiddenCount: schedules.length - CARE_SCHEDULE_PREVIEW_COUNT,
  };
}
