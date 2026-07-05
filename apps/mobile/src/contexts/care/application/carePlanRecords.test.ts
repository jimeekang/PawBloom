import type { CareMedicationSchedule } from "../domain/carePlan";
import { buildQuickDoseFromSchedule, mapCareSetupForTest, normalizeCareLocalTime } from "./carePlanRecords";

const schedule: CareMedicationSchedule = {
  id: "schedule-1",
  medicationId: "medication-1",
  medicationName: "Cerenia",
  dosageLabel: "16mg 1정",
  conditionName: "구토",
  localTime: "08:00:00",
  startsOn: "2026-06-30",
  recurrenceIntervalDays: 1,
};

const dose = buildQuickDoseFromSchedule(schedule, "partial");
const medicationName: string = dose.medicationName;
const status: "partial" = dose.status;

void medicationName;
void status;

const condition = {
  id: "condition-1",
  pet_id: "pet-1",
  name: "구토",
  status: "active",
  vet_instructions: null,
  starts_on: "2026-06-30",
  ends_on: null,
  created_by: "user-1",
  created_at: "2026-06-30T00:00:00.000Z",
  updated_at: "2026-06-30T00:00:00.000Z",
};

const plan = {
  id: "plan-1",
  pet_id: "pet-1",
  condition_id: "condition-1",
  title: "위장 케어",
  instructions: "식후 관찰",
  starts_on: "2026-06-30",
  ends_on: null,
  created_by: "user-1",
  created_at: "2026-06-30T00:00:00.000Z",
  updated_at: "2026-06-30T00:00:00.000Z",
};

const medication = {
  id: "medication-1",
  pet_id: "pet-1",
  condition_id: "condition-1",
  name: "Cerenia",
  dosage_label: "16mg 1정",
  vet_instructions: null,
  created_by: "user-1",
  created_at: "2026-06-30T00:00:00.000Z",
  updated_at: "2026-06-30T00:00:00.000Z",
};

const medicationSchedule = {
  id: "schedule-1",
  pet_id: "pet-1",
  medication_id: "medication-1",
  local_time: "08:00:00",
  starts_on: "2026-06-30",
  ends_on: null,
  recurrence_interval_days: 1,
  created_by: "user-1",
  created_at: "2026-06-30T00:00:00.000Z",
};

const setup = mapCareSetupForTest([condition], [plan], [medication], [medicationSchedule]);

if (setup.condition?.name !== "구토") throw new Error("care setup must expose active condition name");
if (setup.condition?.status !== "active") throw new Error("care setup must expose active condition status");
if (setup.plan?.title !== "위장 케어") throw new Error("care setup must expose active plan title");
if (setup.schedules[0]?.medicationName !== "Cerenia") throw new Error("care setup schedules must include medication name");
if (setup.schedules[0]?.localTime !== "08:00:00") throw new Error("care setup schedules must keep local medication time");
if (setup.schedules[0]?.startsOn !== "2026-06-30") throw new Error("care setup schedules must keep treatment start date");
if (setup.schedules[0]?.recurrenceIntervalDays !== 1) throw new Error("care setup schedules must default to daily recurrence");

const olderPlan = { ...plan, id: "plan-old", condition_id: "condition-old", title: "이전 케어" };
const matchedSetup = mapCareSetupForTest([condition], [olderPlan, plan], [medication], [medicationSchedule]);
if (matchedSetup.plan?.title !== "위장 케어") throw new Error("care setup must prefer the plan linked to the active condition");

const secondCondition = {
  ...condition,
  id: "condition-2",
  name: "피부염",
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
};

const secondMedication = {
  ...medication,
  id: "medication-2",
  condition_id: "condition-2",
  name: "연고",
  dosage_label: "얇게 1회",
};

const secondSchedule = {
  ...medicationSchedule,
  id: "schedule-2",
  medication_id: "medication-2",
  local_time: "20:30:00",
  starts_on: "2026-07-04",
  ends_on: "2026-07-12",
  recurrence_interval_days: 2,
};

const multiSetup = mapCareSetupForTest(
  [secondCondition, condition],
  [plan],
  [medication, secondMedication],
  [medicationSchedule, secondSchedule],
);

if (multiSetup.conditions.length !== 2) throw new Error("care setup must expose all active conditions");
if (multiSetup.conditions[0]?.name !== "피부염") throw new Error("care setup must keep newest condition first");
if (multiSetup.schedules.length !== 2) throw new Error("care setup must expose all medication schedules");
if (multiSetup.schedules[1]?.conditionId !== "condition-2") throw new Error("schedule must expose linked condition id");
if (multiSetup.schedules[1]?.conditionName !== "피부염") throw new Error("schedule must expose linked condition name");
if (multiSetup.schedules[1]?.startsOn !== "2026-07-04") throw new Error("schedule must expose treatment start date");
if (multiSetup.schedules[1]?.endsOn !== "2026-07-12") throw new Error("schedule must expose treatment end date");
if (multiSetup.schedules[1]?.recurrenceIntervalDays !== 2) throw new Error("schedule must expose recurrence interval");

if (normalizeCareLocalTime("8:5") !== "08:05:00") throw new Error("care local time must normalize one-digit hour and minute");
if (normalizeCareLocalTime("") !== "08:00:00") throw new Error("empty care local time must fall back to 08:00:00");
if (normalizeCareLocalTime("ab:cd") !== "08:00:00") throw new Error("invalid care local time must fall back to 08:00:00");
if (normalizeCareLocalTime("24:00") !== "08:00:00") throw new Error("out-of-range care local time must fall back to 08:00:00");
if (normalizeCareLocalTime("9") !== "09:00:00") throw new Error("hour-only care local time must use zero minutes");
