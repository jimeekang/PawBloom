import { daysBetweenLocalDates, scheduleAppliesOnDate } from "./medicationScheduleRules";

if (daysBetweenLocalDates("2026-07-04", "2026-07-06") !== 2) {
  throw new Error("local date day difference must count calendar days");
}

const everyTwoDays = {
  startsOn: "2026-07-04",
  endsOn: "2026-07-10",
  recurrenceIntervalDays: 2,
};

if (!scheduleAppliesOnDate(everyTwoDays, "2026-07-04")) throw new Error("schedule must apply on the start date");
if (scheduleAppliesOnDate(everyTwoDays, "2026-07-05")) throw new Error("every-2-days schedule must skip the next day");
if (!scheduleAppliesOnDate(everyTwoDays, "2026-07-06")) throw new Error("every-2-days schedule must apply two days after start");
if (scheduleAppliesOnDate(everyTwoDays, "2026-07-11")) throw new Error("schedule must not apply after the end date");
if (scheduleAppliesOnDate(everyTwoDays, "2026-07-03")) throw new Error("schedule must not apply before the start date");
if (!scheduleAppliesOnDate({ startsOn: "2026-07-04", recurrenceIntervalDays: 1 }, "2026-07-05")) {
  throw new Error("daily schedule must apply every day after start");
}
