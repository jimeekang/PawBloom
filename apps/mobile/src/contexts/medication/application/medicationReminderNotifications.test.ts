import type { MedicationSchedule } from "../domain/medicationSchedule";
import { accountScopedMedicationReminderIdentifier, buildMedicationReminderPlan, buildMedicationReminderRequests, hasMedicationReminderCoverage, installMedicationReminderForActiveAccount, installMedicationReminderPlan, isMedicationReminderAccountActive, setActiveMedicationReminderAccount, shouldCancelMedicationReminder, shouldCancelMedicationReminderForAccount, shouldCancelMedicationReminderForOtherAccount } from "./medicationReminderNotifications";

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

const scheduleIds = new Set(["schedule-1", "schedule-legacy"]);
if (!shouldCancelMedicationReminder({ identifier: "medication:schedule-1:2026-07-04", content: { data: { petId: "pet-1" } } }, "pet-1", scheduleIds)) {
  throw new Error("rescheduling must cancel the current pet reminder");
}
if (shouldCancelMedicationReminder({ identifier: "medication:schedule-other:2026-07-04", content: { data: { petId: "pet-2" } } }, "pet-1", scheduleIds)) {
  throw new Error("rescheduling must preserve another pet reminder");
}
if (!shouldCancelMedicationReminder({ identifier: "medication:schedule-legacy:2026-07-04" }, "pet-1", scheduleIds)) {
  throw new Error("rescheduling must cancel a legacy reminder belonging to a known current-pet schedule");
}
if (shouldCancelMedicationReminder({ identifier: "medication:schedule-other:2026-07-04" }, "pet-1", scheduleIds)) {
  throw new Error("rescheduling must preserve an unowned legacy reminder");
}
if (shouldCancelMedicationReminder({ identifier: "medication:schedule-1:2026-07-04", content: { data: { userId: "account-b", petId: "pet-1" } } }, "pet-1", scheduleIds, "account-a")) {
  throw new Error("rescheduling must not adopt another account's reminder even when the pet is shared");
}
if (!shouldCancelMedicationReminderForAccount({ identifier: "medication:schedule-1:2026-07-04", content: { data: { userId: "account-a" } } }, "account-a")) {
  throw new Error("logout must cancel reminders owned by the previous account");
}
if (shouldCancelMedicationReminderForAccount({ identifier: "medication:schedule-1:2026-07-04", content: { data: { userId: "account-b" } } }, "account-a")) {
  throw new Error("account cleanup must preserve reminders owned by another signed-in account");
}
if (!shouldCancelMedicationReminderForAccount({ identifier: "medication:schedule-legacy:2026-07-04" }, "account-a")) {
  throw new Error("account cleanup must remove legacy unscoped medication reminders to prevent privacy leakage");
}
if (shouldCancelMedicationReminderForAccount({ identifier: "calendar:event" }, "account-a")) {
  throw new Error("account cleanup must preserve notifications outside PawBloom medication reminders");
}
if (!shouldCancelMedicationReminderForOtherAccount({ identifier: "medication:schedule-1:daily", content: { data: { userId: "account-a" } } }, "account-b")
  || shouldCancelMedicationReminderForOtherAccount({ identifier: "medication:schedule-2:daily", content: { data: { userId: "account-b" } } }, "account-b")) {
  throw new Error("new reminder plans must free capacity from the previous account without deleting current-account reminders");
}
if (accountScopedMedicationReminderIdentifier("account-a", "medication:schedule-1:daily") === accountScopedMedicationReminderIdentifier("account-b", "medication:schedule-1:daily")) {
  throw new Error("shared-pet reminder identifiers must not collide across accounts during cleanup races");
}

setActiveMedicationReminderAccount("account-a");
if (!isMedicationReminderAccountActive("account-a")) throw new Error("the signed-in account must own new reminder work");
const accountRaceOperations: string[] = [];
try {
  await installMedicationReminderForActiveAccount("account-a", {
    identifier: "medication:schedule-1:daily",
    dateKey: "daily",
    scheduleId: "schedule-1",
    title: "title",
    body: "body",
    trigger: { kind: "daily", hour: 8, minute: 30 },
  }, async () => {
    accountRaceOperations.push("schedule");
    setActiveMedicationReminderAccount("account-b");
  }, async () => { accountRaceOperations.push("cancel"); });
} catch {
  // Expected: the account changed while the native scheduler was in flight.
}
if (accountRaceOperations.join(",") !== "schedule,cancel" || isMedicationReminderAccountActive("account-a")) {
  throw new Error("a reminder that finishes after logout must be canceled immediately");
}
setActiveMedicationReminderAccount(null);

const openEndedDaily: MedicationSchedule = { ...schedule, id: "daily", endsOn: undefined, recurrenceIntervalDays: 1 };
const dailyPlan = buildMedicationReminderPlan({ petName: "잉꼬", schedules: [openEndedDaily], fromDate: "2026-07-04", maxPending: 60 });
if (dailyPlan.length !== 1 || dailyPlan[0]?.trigger.kind !== "daily" || dailyPlan[0]?.identifier !== "medication:daily:daily") {
  throw new Error("an open-ended daily medicine must use one repeating reminder instead of stopping after day 30");
}

const manyOneShots = buildMedicationReminderPlan({ petName: "잉꼬", schedules: [{ ...schedule, endsOn: undefined }], fromDate: "2026-07-04", maxPending: 12 });
if (manyOneShots.length !== 12 || manyOneShots.some((request) => request.trigger.kind !== "date")) {
  throw new Error("non-daily reminders must honor the allocated iOS pending-notification budget");
}

const tooManyDailySchedules = Array.from({ length: 61 }, (_, index) => ({ ...openEndedDaily, id: `daily-${index}` }));
const capacityPlan = buildMedicationReminderPlan({ petName: "잉꼬", schedules: tooManyDailySchedules, fromDate: "2026-07-04", maxPending: 60 });
if (hasMedicationReminderCoverage(capacityPlan, tooManyDailySchedules, "2026-07-04")) {
  throw new Error("capacity exhaustion must be reported instead of silently omitting a medication schedule");
}

const futureOnly = buildMedicationReminderPlan({ petName: "잉꼬", schedules: [{ ...schedule, endsOn: undefined }], fromDate: "2026-07-04", maxPending: 2, notBefore: new Date(2026, 6, 4, 12, 0) });
if (futureOnly[0]?.dateKey !== "2026-07-06") {
  throw new Error("rescheduling must not fire a missed morning dose reminder immediately after its trigger time has passed");
}

const operations: string[] = [];
await installMedicationReminderPlan(dailyPlan, [
  { identifier: "medication:daily:2026-07-04", content: { data: { scheduleId: "daily" } } },
  { identifier: "medication:removed:2026-07-04", content: { data: { scheduleId: "removed" } } },
], async (request) => { operations.push(`schedule:${request.identifier}`); }, async (identifier) => { operations.push(`cancel:${identifier}`); });
if (operations[0] !== "schedule:medication:daily:daily" || operations.some((operation, index) => operation.startsWith("cancel:") && index === 0)) {
  throw new Error("reminder replacement must install coverage before canceling an existing reminder");
}

const rollingOperations: string[] = [];
await installMedicationReminderPlan(manyOneShots.slice(0, 2), [
  { identifier: "medication:schedule-1:old-a", content: { data: { scheduleId: "schedule-1" } } },
  { identifier: "medication:schedule-1:old-b", content: { data: { scheduleId: "schedule-1" } } },
], async (request) => { rollingOperations.push(`schedule:${request.identifier}`); }, async (identifier) => { rollingOperations.push(`cancel:${identifier}`); });
if (!rollingOperations.every((operation, index) => !operation.startsWith("cancel:") || rollingOperations[index - 1]?.startsWith("schedule:"))) {
  throw new Error("rolling reminder replacement must free one obsolete slot only after installing its replacement");
}
