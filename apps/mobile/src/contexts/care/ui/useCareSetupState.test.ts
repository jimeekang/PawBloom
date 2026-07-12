import { buildNextLocalCareSetup } from "./careSetupLocalState";

const emptySetup = { conditions: [], plans: [], schedules: [] };

const conditionOnly = buildNextLocalCareSetup(emptySetup, {
  conditionName: "피부염",
  planTitle: "2주 관찰",
  medicationName: "",
  dosageLabel: "",
}, 1000);

if (conditionOnly.conditions.length !== 1 || conditionOnly.schedules.length !== 0) {
  throw new Error("local care setup must not create a medication schedule when only condition or plan fields are saved");
}

const withMedication = buildNextLocalCareSetup(conditionOnly, {
  conditionName: "피부염",
  planTitle: "2주 관찰",
  medicationName: "항생제",
  dosageLabel: "1정",
  localTime: "09:30",
  startsOn: "2026-07-07",
  recurrenceIntervalDays: 2,
}, 2000);

if (withMedication.schedules[0]?.medicationName !== "항생제" || withMedication.schedules[0]?.localTime !== "09:30:00" || withMedication.schedules[0]?.recurrenceIntervalDays !== 2) {
  throw new Error("local care setup must create a medication schedule only when medication details are present");
}

const updatedMedication = buildNextLocalCareSetup(withMedication, {
  conditionId: withMedication.condition?.id,
  planId: withMedication.plan?.id,
  medicationId: withMedication.schedules[0]?.medicationId,
  scheduleIds: [withMedication.schedules[0]?.id ?? ""],
  conditionName: "피부염",
  planTitle: "2주 관찰",
  medicationName: "항생제",
  dosageLabel: "반 정",
  localTimes: ["09:30", "20:30"],
  startsOn: "2026-07-07",
  recurrenceIntervalDays: 2,
}, 3000);

if (updatedMedication.conditions.length !== 1 || updatedMedication.schedules.length !== 2) {
  throw new Error("local care setup updates must reuse the condition and preserve every requested medication time");
}
if (updatedMedication.schedules.find((item) => item.id === withMedication.schedules[0]?.id)?.dosageLabel !== "반 정") {
  throw new Error("local care setup updates must keep an existing schedule id while updating its values");
}

const reducedMedication = buildNextLocalCareSetup(updatedMedication, {
  conditionId: updatedMedication.condition?.id,
  planId: updatedMedication.plan?.id,
  medicationId: updatedMedication.schedules[0]?.medicationId,
  scheduleIds: [updatedMedication.schedules[1]?.id ?? ""],
  conditionName: "피부염",
  planTitle: "2주 관찰",
  medicationName: "항생제",
  dosageLabel: "반 정",
  localTimes: ["20:30"],
  startsOn: "2026-07-07",
  recurrenceIntervalDays: 2,
}, 4000);

if (reducedMedication.schedules.length !== 1 || reducedMedication.schedules[0]?.localTime !== "20:30:00") {
  throw new Error("local care setup updates must remove schedules omitted from the requested medication schedule set");
}

const separatePlan = buildNextLocalCareSetup(conditionOnly, {
  conditionName: "관절염",
  planTitle: "새 관리 계획",
  medicationName: "",
  dosageLabel: "",
}, 5000);
if (separatePlan.plan?.id === conditionOnly.plan?.id) {
  throw new Error("a new local condition must not silently rename an unrelated existing care plan");
}
