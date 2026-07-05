import { buildMedicationScheduleInsertRows, buildScheduledMedicationDoseInput, mapMedicationSchedulesForTest, normalizeMedicationLocalTime } from "./medicationSchedulePayload";

const medication = {
  id: "medication-1",
  pet_id: "pet-1",
  condition_id: "condition-1",
  name: "Cerenia",
  dosage_label: "16mg 1정",
  vet_instructions: null,
  created_by: "user-1",
  created_at: "2026-07-05T00:00:00.000Z",
  updated_at: "2026-07-05T00:00:00.000Z",
};

const condition = {
  id: "condition-1",
  pet_id: "pet-1",
  name: "구토",
  status: "active",
  vet_instructions: null,
  starts_on: "2026-07-05",
  ends_on: null,
  created_by: "user-1",
  created_at: "2026-07-05T00:00:00.000Z",
  updated_at: "2026-07-05T00:00:00.000Z",
};

const schedule = {
  id: "schedule-1",
  pet_id: "pet-1",
  medication_id: "medication-1",
  local_time: "08:05:00",
  starts_on: "2026-07-05",
  ends_on: "2026-07-12",
  recurrence_interval_days: 3,
  created_by: "user-1",
  created_at: "2026-07-05T00:00:00.000Z",
};

if (normalizeMedicationLocalTime("8:5") !== "08:05:00") throw new Error("medication schedule time must normalize one-digit hour and minute");
if (normalizeMedicationLocalTime("24:00") !== "08:00:00") throw new Error("invalid medication schedule time must fall back to 08:00:00");

const rows = buildMedicationScheduleInsertRows({
  petId: "pet-1",
  userId: "user-1",
  medicationId: "medication-1",
  localTimes: ["8:5", "20:30"],
  startsOn: "2026-07-05",
  endsOn: "2026-07-12",
  recurrenceIntervalDays: 3,
});

if (rows.length !== 2) throw new Error("multiple medication times must create one schedule row per time");
if (rows[0]?.local_time !== "08:05:00" || rows[1]?.local_time !== "20:30:00") throw new Error("schedule rows must store normalized local times");
if (rows[0]?.recurrence_interval_days !== 3 || rows[0]?.ends_on !== "2026-07-12") throw new Error("schedule rows must keep period and custom repeat interval");

const mapped = mapMedicationSchedulesForTest([medication], [schedule], [condition]);
if (mapped[0]?.medicationName !== "Cerenia") throw new Error("mapped schedule must expose medication name");
if (mapped[0]?.conditionName !== "구토") throw new Error("mapped schedule must expose linked condition name");
if (mapped[0]?.localTime !== "08:05:00") throw new Error("mapped schedule must expose schedule time");

const doseInput = buildScheduledMedicationDoseInput(mapped[0]!, "2026-07-05", "completed");
if (doseInput.scheduleId !== "schedule-1") throw new Error("scheduled dose input must retain schedule id");
if (doseInput.scheduledTime !== "08:05") throw new Error("scheduled dose input must use schedule local time");
if (doseInput.status !== "completed") throw new Error("scheduled dose input must carry the selected status");
