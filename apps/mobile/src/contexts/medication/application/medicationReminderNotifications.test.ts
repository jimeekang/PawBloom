import type { MedicationSchedule } from "../domain/medicationSchedule";
import { buildMedicationReminderRequests } from "./medicationReminderNotifications";

const schedule: MedicationSchedule = {
  id: "schedule-1",
  medicationId: "medication-1",
  medicationName: "항생제",
  dosageLabel: "1정",
  conditionName: "피부염",
  localTime: "08:30:00",
  startsOn: "2026-07-04",
  endsOn: "2026-07-08",
  recurrenceIntervalDays: 2,
};

const requests = buildMedicationReminderRequests({
  petName: "잉꼬",
  schedules: [schedule],
  fromDate: "2026-07-04",
  daysAhead: 5,
});

if (requests.length !== 3) throw new Error("every-2-days reminder must be scheduled only for matching dates in range");
if (requests[0]?.dateKey !== "2026-07-04" || requests[1]?.dateKey !== "2026-07-06" || requests[2]?.dateKey !== "2026-07-08") {
  throw new Error("reminder dates must follow the recurrence interval from start date");
}
if (!requests[0]?.title.includes("잉꼬") || !requests[0]?.body.includes("항생제")) {
  throw new Error("reminder copy must include pet and medicine names");
}
