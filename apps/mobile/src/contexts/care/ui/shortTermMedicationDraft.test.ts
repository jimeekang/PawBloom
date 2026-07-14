import { SHORT_TERM_DEFAULT_DURATION_DAYS, addDaysToDateKey, buildShortTermCareSetupInput, createShortTermMedicationDraft, shortTermDraftErrorKey } from "./shortTermMedicationDraft";

if (addDaysToDateKey("2026-07-14", 7) !== "2026-07-21") throw new Error("addDaysToDateKey must add days within a month");
if (addDaysToDateKey("2026-07-28", 7) !== "2026-08-04") throw new Error("addDaysToDateKey must roll over month ends");
if (addDaysToDateKey("2026-12-30", 7) !== "2027-01-06") throw new Error("addDaysToDateKey must roll over year ends");

const draft = createShortTermMedicationDraft("2026-07-14");
if (draft.startsOn !== "2026-07-14") throw new Error("short-term draft must start on the provided day");
if (draft.endsOn !== addDaysToDateKey("2026-07-14", SHORT_TERM_DEFAULT_DURATION_DAYS)) throw new Error("short-term draft must default to a 7-day course");
if (draft.times.length !== 1 || draft.times[0] !== "08:00") throw new Error("short-term draft must start with one 08:00 dose time");

if (shortTermDraftErrorKey(draft) !== "care.quickDoseMedicationRequired") throw new Error("empty medication name must be rejected");
const named = { ...draft, medicationName: "Amoxicillin" };
if (shortTermDraftErrorKey(named) !== null) throw new Error("valid draft must pass validation");
if (shortTermDraftErrorKey({ ...named, endsOn: "2026-07-13" }) !== "care.shortTermPeriodInvalid") throw new Error("end date before start must be rejected");
if (shortTermDraftErrorKey({ ...named, endsOn: named.startsOn }) !== null) throw new Error("single-day course must be allowed");

const input = buildShortTermCareSetupInput({ ...named, conditionName: " 기침 ", dosageLabel: " 1정 ", times: ["08:00", "20:00"] });
if (input.medicationId !== undefined || input.scheduleIds !== undefined || input.conditionId !== undefined || input.planId !== undefined) {
  throw new Error("short-term input must create new records instead of editing existing ones");
}
if (input.endsOn !== named.endsOn || input.startsOn !== named.startsOn) throw new Error("short-term input must keep the course period");
if (input.localTime !== "08:00" || input.localTimes?.length !== 2) throw new Error("short-term input must carry all dose times");
if (input.conditionName !== "기침" || input.dosageLabel !== "1정" || input.planTitle !== "") throw new Error("short-term input must trim text fields and skip plan title");
if (input.recurrenceIntervalDays !== 1) throw new Error("short-term course must repeat daily");
