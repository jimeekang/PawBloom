import type { CareMedicationSchedule } from "../../contexts/care/domain/carePlan";
import type { DoseRecord } from "../../contexts/medication/domain/medication";
import { createTodayMedicationAgendaRows, findPendingMedicationAgendaRow } from "./todayMedicationAgenda";

const schedule: CareMedicationSchedule = {
  id: "schedule-1",
  medicationId: "medication-1",
  medicationName: "항생제",
  dosageLabel: "1정",
  conditionId: "condition-1",
  conditionName: "피부염",
  localTime: "08:30:00",
  startsOn: "2026-07-04",
  recurrenceIntervalDays: 2,
};

const rows = createTodayMedicationAgendaRows({ schedules: [schedule], doses: [], doseDate: "2026-07-04" });
if (rows[0]?.source !== "schedule" || rows[0]?.status !== "pending") {
  throw new Error("schedule-only agenda row must appear as pending without a saved dose");
}

const dose: DoseRecord = {
  id: "dose-1",
  petId: "pet-1",
  scheduleId: "schedule-1",
  doseDate: "2026-07-04",
  medicationName: "항생제",
  dosageLabel: "1정",
  conditionName: "피부염",
  scheduledAt: "08:30",
  status: "completed",
};

const mergedRows = createTodayMedicationAgendaRows({ schedules: [schedule], doses: [dose], doseDate: "2026-07-04" });
if (mergedRows.length !== 1 || mergedRows[0]?.source !== "dose" || mergedRows[0]?.status !== "completed") {
  throw new Error("saved dose must replace the virtual schedule row for the same date");
}

const skippedRows = createTodayMedicationAgendaRows({ schedules: [schedule], doses: [], doseDate: "2026-07-05" });
if (skippedRows.length !== 0) {
  throw new Error("agenda must not show schedules that do not apply to the selected date");
}

const firstPendingRow = findPendingMedicationAgendaRow([
  { ...rows[0]!, status: "completed" },
  { ...rows[0]!, scheduleId: "schedule-2", status: "pending", scheduledTime: "20:00" },
]);
if (firstPendingRow?.scheduleId !== "schedule-2") {
  throw new Error("today checklist must target the first pending scheduled medication instead of creating a duplicate dose");
}
