import { buildNextLocalCareSetup } from "./careSetupLocalState";

const emptySetup = { conditions: [], schedules: [] };

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
