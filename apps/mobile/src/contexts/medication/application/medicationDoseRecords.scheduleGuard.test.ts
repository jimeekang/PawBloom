import { buildMedicationDoseInsertPayload, findDoseForScheduleDate, mergeSavedDoseIntoList } from "./medicationDosePayload";

const payload = buildMedicationDoseInsertPayload({
  scheduleId: "schedule-1",
  doseDate: "2026-07-04",
  scheduledTime: "08:30",
  medicationName: "항생제",
  conditionName: "피부염",
  dosageLabel: "1정",
  status: "completed",
});

if (payload.schedule_id !== "schedule-1") throw new Error("scheduled dose payload must keep schedule id");
if (payload.dose_date !== "2026-07-04") throw new Error("scheduled dose payload must keep local dose date");
if (!payload.scheduled_at.includes("T")) throw new Error("scheduled dose payload must build a scheduled timestamp");

const existing = {
  id: "dose-1",
  petId: "pet-1",
  scheduleId: "schedule-1",
  doseDate: "2026-07-04",
  medicationName: "항생제",
  scheduledAt: "08:30",
  status: "pending" as const,
};

if (findDoseForScheduleDate([existing], "schedule-1", "2026-07-04")?.id !== "dose-1") {
  throw new Error("schedule/date lookup must find the existing dose");
}

const merged = mergeSavedDoseIntoList([existing], { ...existing, status: "completed" });
if (merged.length !== 1 || merged[0]?.status !== "completed") {
  throw new Error("saving a schedule-backed dose must replace the existing schedule/date dose");
}
