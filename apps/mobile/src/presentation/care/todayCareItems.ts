import type { PetRoutine } from "../../contexts/routine/domain/petRoutine";
import type { DiaryEntry } from "../../contexts/diary/domain/diaryEntry";
import type { DoseRecord } from "../../contexts/medication/domain/medication";
import type { CareMedicationSchedule } from "../../contexts/care/domain/carePlan";
import { createTodayMedicationAgendaRows } from "../../contexts/medication/ui/todayMedicationAgenda";
import { createCareSummaryRows } from "../screens/HomeDashboardPanel.logic";
import type { TodayCareItem } from "../screens/TodayCareScreen";
import { t, type TranslationKey } from "../../i18n/translations";
/** Exact pet/date filtering precedes agenda merging; one schedule/date produces one row. */
export function createAllPetsTodayCareItems(petId: string, dateKey: string, routine: PetRoutine, schedules: CareMedicationSchedule[], doses: DoseRecord[], entries: DiaryEntry[]): TodayCareItem[] {
  const todayDoses = doses.filter((dose) => dose.petId === petId && dose.doseDate === dateKey);
  const diary = entries.filter((entry) => entry.petId === petId && entry.entryDate === dateKey);
  const agenda = createTodayMedicationAgendaRows({ schedules, doses: todayDoses, doseDate: dateKey });
  const summaries = createCareSummaryRows(todayDoses, agenda);
  const rows: TodayCareItem[] = agenda.map((row) => {
    const id = row.doseId ?? `schedule-${row.scheduleId ?? "none"}-${row.doseDate}-${row.scheduledTime}`;
    const summary = summaries.find((item) => item.id === id)!;
    return { id, label: `${summary.timeLabel} ${summary.title} · ${summary.statusLabel}`, source: row.source, dateKey, scheduledTime: row.scheduledTime, status: row.status, scheduleId: row.scheduleId, doseId: row.doseId, destination: { view: "medication", scheduleId: row.scheduleId, dateKey } };
  });
  const categories = ["food", "water", "walk", "stool", "condition"] as const;
  for (const category of categories) {
    if (category === "walk" && routine.walk.enabled === false) continue;
    const done = diary.some((entry) => entry.category === category);
    rows.push({ id: `routine-${category}`, label: t(`category.${category}` as TranslationKey), source: "routine", dateKey, status: done ? "completed" : "pending", destination: { view: "diary", dateKey } });
  }
  return rows.sort((a, b) => (a.scheduledTime ?? "99:99").localeCompare(b.scheduledTime ?? "99:99") || a.id.localeCompare(b.id));
}
