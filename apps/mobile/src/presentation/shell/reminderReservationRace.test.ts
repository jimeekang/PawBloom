declare const require: (name: string) => any;
const modules = require("node:module"), original = modules._load;
const realSet = globalThis.setTimeout, realClear = globalThis.clearTimeout;
const timers = new Map<number, () => void>(); let timerId = 0;
(globalThis as any).setTimeout = (callback: () => void, ms: number) => ms > 1500 ? realSet(callback, ms) : (timers.set(++timerId, callback), timerId);
(globalThis as any).clearTimeout = (id: any) => typeof id === "number" ? timers.delete(id) : realClear(id);
let identityRead: () => Promise<any>, delayInstall = false, releaseInstall: (() => void) | undefined, installed = 0, canceled = 0;
const native = new Map<string, any>();
modules._load = function(name: string, parent: unknown, main: boolean) {
  if (name.endsWith("/notificationPetIdentity")) return { fetchNotificationPetIdentity: () => identityRead() };
  if (name === "expo-notifications") return {
    requestPermissionsAsync: async () => ({ granted: true }), getPermissionsAsync: async () => ({ granted: true }),
    getAllScheduledNotificationsAsync: async () => [...native.values()],
    scheduleNotificationAsync: async (value: any) => { installed++; if (delayInstall) { delayInstall = false; await new Promise<void>((resolve) => { releaseInstall = resolve; }); } native.set(value.identifier, value); },
    cancelScheduledNotificationAsync: async (id: string) => { canceled++; native.delete(id); }, SchedulableTriggerInputTypes: { DAILY: "daily", DATE: "date" },
  };
  return original.call(this, name, parent, main);
};
try {
  const med = require("../../contexts/medication/application/medicationReminderNotifications"), meal = require("../../contexts/routine/application/mealReminderNotifications");
  const strong = { petCreatedAt: "pet", schedules: { new: "schedule" } };
  const schedule = { id: "new", medicationId: "m", medicationName: "Med", dosageLabel: "1", localTime: "08:00", startsOn: "2020-01-01", recurrenceIntervalDays: 1 };
  const routine = { petId: "a", food: { meals: { breakfast: { localTime: "08:00" } } }, water: {}, walk: {}, stool: {}, condition: {} };
  for (const kind of ["med", "meal"]) {
    const api = kind === "med" ? med : meal;
    const input = kind === "med" ? { userId: "u", petId: "a", petName: "A", reminderTitle: "med", schedules: [schedule], previousScheduleIds: ["old"], fromDate: "2026-10-20", identityTimeoutMs: 100 } : { userId: "u", petId: "a", petName: "A", title: "meal", slotLabels: {}, routine, requestPermission: true, identityTimeoutMs: 100 };
    const run = (value: any = {}) => kind === "med" ? med.rescheduleMedicationReminders({ ...input, ...value }) : meal.rescheduleMealReminders({ ...input, ...value });
    const newPlan = kind === "med" ? { schedules: [{ ...schedule, localTime: "09:00" }] } : { routine: { ...routine, food: { meals: { breakfast: { localTime: "09:00" } } } } };
    const emptyPlan = kind === "med" ? { schedules: [] } : { routine: { ...routine, food: { ...routine.food, mealRemindersEnabled: false } } };
    const cancel = (action: string) => kind === "med" ? action === "pet" ? med.cancelMedicationRemindersForPet("u", "a") : med.cancelMedicationRemindersForAccount("u") : action === "pet" ? meal.cancelMealRemindersForPet("u", "a") : meal.cancelMealRemindersForAccount("u");
    function reset() { assert(timers.size === 0, `${kind}: no timer leak`); native.clear(); installed = 0; canceled = 0; delayInstall = false; api[kind === "med" ? "setActiveMedicationReminderAccount" : "setActiveMealReminderAccount"]("u"); const id = kind === "med" ? "medication:u:old:daily" : "meal:u:a:lunch"; native.set(id, { identifier: id, content: { data: { userId: "u", petId: "a", scheduleId: "old" } } }); }
    for (const action of ["empty", "new", "pet", "account"]) for (const finish of ["resolve", "timeout"]) {
      reset(); let resolve!: (value: any) => void; identityRead = () => new Promise((done) => { resolve = done; });
      const old = run(); await flush(); identityRead = async () => strong;
      if (action === "empty") await run(emptyPlan); else if (action === "new") await run(newPlan); else await cancel(action);
      const counts = [installed, canceled], snapshot = JSON.stringify([...native]);
      if (finish === "resolve") resolve(strong); else expire(); await flush();
      assert(await old, `${kind}: superseded operation ends normally without a false permission-denied result after ${action}/${finish}`);
      assert(installed === counts[0] && canceled === counts[1] && JSON.stringify([...native]) === snapshot, `${kind}: ${action}/${finish} cannot reinstall or cancel the newer plan`);
      if (finish === "timeout") { resolve(strong); await flush(); }
      assert(timers.size === 0, `${kind}: obsolete lookup timer cleaned`);
    }
    for (const action of ["new", "pet", "account"]) {
      reset(); identityRead = async () => strong; delayInstall = true;
      const old = run(); await flush(); assert(releaseInstall && installed === 1, `${kind}: old native install is in flight`);
      const newer = action === "new" ? run(newPlan) : cancel(action); await flush();
      assert(installed === 1 && canceled === 0, `${kind}: newer native operations wait for already-started install`);
      releaseInstall!(); await Promise.all([old, newer]);
      assert(action === "new" ? [...native.values()].some((item) => item.trigger?.hour === 9) && native.size === 1 : native.size === 0, `${kind}: late native install cannot overwrite ${action}`);
      assert(timers.size === 0, `${kind}: native race timer cleanup`);
    }
    for (const action of ["pet", "account"]) {
      reset(); identityRead = async () => strong; delayInstall = true;
      const old = run(); await flush(); const canceling = cancel(action); await flush();
      const newest = run(newPlan); await flush(); assert(installed === 1 && canceled === 0, `${kind}: C waits behind B cancellation barrier`);
      releaseInstall!(); await Promise.all([old, canceling, newest]);
      assert(native.size === 1 && [...native.values()][0].trigger.hour === 9, `${kind}: newer C survives older B ${action} cancellation`);
      assert(timers.size === 0, `${kind}: three-operation race cleans timers`);
    }
  }
} finally { modules._load = original; globalThis.setTimeout = realSet; globalThis.clearTimeout = realClear; }
function expire() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } }
async function flush() { for (let i = 0; i < 50; i++) await Promise.resolve(); }
function assert(value: unknown, message: string): void { if (!value) throw new Error(message); }
export {};
