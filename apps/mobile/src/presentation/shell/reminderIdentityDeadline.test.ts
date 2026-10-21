declare const require: (name: string) => any;
const modules = require("node:module"), originalLoad = modules._load;
const originalSetTimeout = globalThis.setTimeout, originalClearTimeout = globalThis.clearTimeout;
const timers = new Map<number, { at: number; callback: () => void }>();
let now = 0, nextTimer = 0, identityReads = 0, requests = 0, allowed = true, nativeError = false;
let identity: () => Promise<any>, installed: any[] = [], canceled: string[] = [], pending: any[] = [];
let permissionRead: () => Promise<{ granted: boolean }> = async () => ({ granted: allowed });
(globalThis as any).setTimeout = (callback: () => void, ms: number) => { if (ms > 1500) return originalSetTimeout(callback, ms); const id = ++nextTimer; timers.set(id, { at: now + ms, callback }); return id; };
(globalThis as any).clearTimeout = (id: any) => { if (typeof id === "number") timers.delete(id); else originalClearTimeout(id); };
modules._load = function(name: string, parent: unknown, main: boolean) {
  if (name.endsWith("/notificationPetIdentity")) return { fetchNotificationPetIdentity: () => { identityReads++; return identity(); } };
  if (name === "expo-notifications") return {
    requestPermissionsAsync: () => { requests++; return permissionRead(); }, getPermissionsAsync: () => permissionRead(),
    getAllScheduledNotificationsAsync: async () => pending,
    scheduleNotificationAsync: async (value: any) => { if (nativeError) throw new Error("native failure"); installed.push(value); },
    cancelScheduledNotificationAsync: async (id: string) => { canceled.push(id); }, SchedulableTriggerInputTypes: { DAILY: "daily", DATE: "date" },
  };
  return originalLoad.call(this, name, parent, main);
};
try {
  const med = require("../../contexts/medication/application/medicationReminderNotifications"), meal = require("../../contexts/routine/application/mealReminderNotifications");
  const schedule = { id: "new", medicationId: "m", medicationName: "Med", dosageLabel: "1", localTime: "08:00", startsOn: "2020-01-01", recurrenceIntervalDays: 1 };
  const medInput = { userId: "u", petId: "a", petName: "A", reminderTitle: "med", schedules: [schedule], previousScheduleIds: ["old"], fromDate: "2026-10-20", identityTimeoutMs: 100 };
  const routine = { petId: "a", food: { meals: { breakfast: { localTime: "08:00" } } }, water: {}, walk: {}, stool: {}, condition: {} };
  const mealInput = { userId: "u", petId: "a", petName: "A", title: "meal", slotLabels: {}, routine, requestPermission: true, identityTimeoutMs: 100 };
  const strong = { petCreatedAt: "pet-created", schedules: { new: "schedule-created" } };
  for (const kind of ["med", "meal"]) {
    const setAccount = kind === "med" ? med.setActiveMedicationReminderAccount : meal.setActiveMealReminderAccount;
    const input = kind === "med" ? medInput : mealInput;
    const run = (override: any = {}) => kind === "med" ? med.rescheduleMedicationReminders({ ...input, ...override }) : meal.rescheduleMealReminders({ ...input, ...override });
    function reset() { assert(timers.size === 0, `${kind}: previous operation cleaned timers`); installed = []; canceled = []; allowed = true; nativeError = false; requests = 0; setAccount("u"); permissionRead = async () => ({ granted: allowed }); pending = kind === "med" ? [{ identifier: "medication:u:old:daily", content: { data: { userId: "u", petId: "a", scheduleId: "old" } } }] : [{ identifier: "meal:u:a:lunch" }]; }
    reset(); let deferred = deferredIdentity(); identity = () => deferred.promise;
    let settled = false; const within = run().then((value: boolean) => { settled = true; return value; }); await flush();
    assert(!settled && installed.length === 0, `${kind}: fast native preparation waits for identity within deadline`);
    advance(99); await flush(); assert(!settled, `${kind}: no premature timeout`);
    deferred.resolve(strong); assert(await within, `${kind}: within-bound success schedules`);
    assert(installed[0].content.data.petCreatedAt === "pet-created" && (kind === "meal" || installed[0].content.data.scheduleCreatedAt === "schedule-created"), `${kind}: within-bound identity produces strong payload`);
    assert(canceled.length === 1 && timers.size === 0, `${kind}: replacement and successful timer cleanup`);
    for (const late of ["resolve", "reject"]) {
      reset(); deferred = deferredIdentity(); identity = () => deferred.promise; let done = false;
      const timeout = run().then((value: boolean) => { done = true; return value; }); await flush(); advance(99); await flush();
      assert(!done && installed.length === 0, `${kind}: unresolved lookup waits only until deadline`);
      advance(1); await flush(); assert(await timeout && installed.length === 1 && canceled.length === 1, `${kind}: exact deadline installs weak replacement`);
      assert(!installed[0].content.data.petCreatedAt && timers.size === 0, `${kind}: timeout weakens payload and clears timer`);
      late === "resolve" ? deferred.resolve(strong) : deferred.reject(new Error("late offline")); await flush();
      assert(installed.length === 1 && canceled.length === 1 && timers.size === 0, `${kind}: late ${late} has no native side effects`);
    }
    for (const result of ["null", "error"]) {
      reset(); identity = result === "null" ? async () => null : async () => { throw new Error("offline"); };
      assert(await run() && !installed[0].content.data.petCreatedAt && timers.size === 0, `${kind}: immediate ${result} schedules weak without waiting`);
    }
    reset(); deferred = deferredIdentity(); identity = () => deferred.promise;
    const switched = run(); await flush(); setAccount(null); deferred.resolve(strong);
    assert(!await switched && installed.length === 0 && timers.size === 0, `${kind}: account loss during identity wait cannot schedule`);
    reset(); deferred = deferredIdentity(); identity = () => deferred.promise; allowed = false;
    assert(!await run() && timers.size === 0 && installed.length === 0, `${kind}: permission early return disposes pending identity timer`);
    deferred.reject(new Error("late denial")); await flush();
    reset(); deferred = deferredIdentity(); identity = () => deferred.promise;
    permissionRead = async () => { throw new Error("permission native failure"); };
    await rejects(run); assert(timers.size === 0, `${kind}: preparation error disposes active timer`); deferred.resolve(strong);
    reset(); identity = async () => strong; nativeError = true;
    await rejects(run); assert(timers.size === 0, `${kind}: install error leaves no timer`);
    reset(); deferred = deferredIdentity(); identity = () => deferred.promise;
    let releasePermission!: (value: { granted: boolean }) => void;
    permissionRead = () => new Promise((resolve) => { releasePermission = resolve; });
    let done = false; const slowNative = run().then((value: boolean) => { done = true; return value; }); await flush();
    advance(100); await flush(); assert(!done && timers.size === 0, `${kind}: lookup deadline runs during native preparation`);
    releasePermission({ granted: true }); await flush(); assert(await slowNative && done && !installed[0].content.data.petCreatedAt && timers.size === 0, `${kind}: slow native prep adds no new identity wait`);
    deferred.resolve(strong); await flush();
    reset(); identity = () => new Promise(() => undefined); const beforeEmpty = identityReads;
    const empty = kind === "med" ? { schedules: [] } : { routine: { ...routine, food: { ...routine.food, mealRemindersEnabled: false } } };
    assert(await run(empty) && identityReads === beforeEmpty && timers.size === 0 && installed.length === 0 && canceled.length === 1, `${kind}: empty plans cancel with no identity request or timer`);
    if (kind === "meal") assert(requests === 0, "disabled meals do not ask permission");
    else { reset(); const beforeExpired = identityReads; assert(await run({ schedules: [{ ...schedule, endsOn: "2026-10-19" }] }) && identityReads === beforeExpired && timers.size === 0 && installed.length === 0, "expired medication plan skips identity lookup/wait"); }
  }
  const { startNotificationIdentityEnrichment, NOTIFICATION_IDENTITY_TIMEOUT_MS } = require("../../contexts/pet/application/notificationIdentityEnrichment");
  assert(NOTIFICATION_IDENTITY_TIMEOUT_MS === 1500, "default is an explicit 1.5s product bound");
  for (const invalid of [NaN, Infinity, -1]) { identity = () => new Promise(() => undefined); const value = startNotificationIdentityEnrichment("a", invalid); advance(1500); assert(await value.result === null && timers.size === 0, "invalid deadline falls back to finite default"); value.dispose(); }
  identity = () => new Promise(() => undefined); const disposed = startNotificationIdentityEnrichment("a"); disposed.dispose(); disposed.dispose(); assert(await disposed.result === null && timers.size === 0, "dispose resolves pending result and is idempotent");
} finally { modules._load = originalLoad; globalThis.setTimeout = originalSetTimeout; globalThis.clearTimeout = originalClearTimeout; }
function deferredIdentity() { let resolve!: (value: any) => void, reject!: (value: unknown) => void; const promise = new Promise<any>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function advance(ms: number) { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); } }
async function flush() { for (let i = 0; i < 30; i++) await Promise.resolve(); }
async function rejects(run: () => Promise<unknown>) { let error: unknown; try { await run(); } catch (value) { error = value; } assert(error instanceof Error && error.message.includes("native failure"), "native errors remain thrown"); }
function assert(value: unknown, message: string): void { if (!value) throw new Error(message); }
export {};
