import type { CareMedicationSchedule } from "../../contexts/care/domain/carePlan";
import { scheduleAppliesOnDate } from "../../contexts/medication/application/medicationScheduleRules";
import type { DoseRecord, DoseStatus } from "../../contexts/medication/domain/medication";

export type TodayMedicationAgendaRow = {
  source: "schedule" | "dose";
  scheduleId?: string;
  doseId?: string;
  doseDate: string;
  medicationName: string;
  conditionName?: string;
  dosageLabel?: string;
  scheduledTime: string;
  status: DoseStatus;
};

export function createTodayMedicationAgendaRows({ schedules, doses, doseDate }: { schedules: CareMedicationSchedule[]; doses: DoseRecord[]; doseDate: string }): TodayMedicationAgendaRow[] {
  const rowsBySchedule = new Map<string, TodayMedicationAgendaRow>();
  for (const schedule of schedules) {
    if (!scheduleAppliesOnDate(schedule, doseDate)) continue;
    rowsBySchedule.set(schedule.id, {
      source: "schedule",
      scheduleId: schedule.id,
      doseDate,
      medicationName: schedule.medicationName,
      conditionName: schedule.conditionName,
      dosageLabel: schedule.dosageLabel,
      scheduledTime: schedule.localTime.slice(0, 5),
      status: "pending",
    });
  }
  const oneTimeRows: TodayMedicationAgendaRow[] = [];
  for (const dose of doses) {
    const row: TodayMedicationAgendaRow = {
      source: "dose",
      scheduleId: dose.scheduleId,
      doseId: dose.id,
      doseDate: dose.doseDate ?? doseDate,
      medicationName: dose.medicationName,
      conditionName: dose.conditionName,
      dosageLabel: dose.dosageLabel,
      scheduledTime: dose.scheduledAt,
      status: dose.status,
    };
    if (dose.scheduleId) rowsBySchedule.set(dose.scheduleId, row);
    else oneTimeRows.push(row);
  }
  return [...rowsBySchedule.values(), ...oneTimeRows].sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
}

export function findPendingMedicationAgendaRow(rows: TodayMedicationAgendaRow[]) {
  return rows.find((row) => row.status === "pending");
}
