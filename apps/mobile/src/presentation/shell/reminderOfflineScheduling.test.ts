declare const require: (name: string) => any;
const modules = require("node:module"), original = modules._load;
let identityRead: () => Promise<any> = async () => null, permission = true, permissionRequests = 0;
let pending: any[] = [], installed: any[] = [], canceled: string[] = [], nativeFailure = false;
const notifications = {
  requestPermissionsAsync: async () => { permissionRequests++; return { granted: permission }; },
  getPermissionsAsync: async () => ({ granted: permission }),
  getAllScheduledNotificationsAsync: async () => pending,
  scheduleNotificationAsync: async (request: any) => { if (nativeFailure) throw new Error("native failure"); installed.push(request); },
  cancelScheduledNotificationAsync: async (id: string) => { canceled.push(id); },
  SchedulableTriggerInputTypes: { DAILY: "daily", DATE: "date" },
};
modules._load = function(name: string, parent: unknown, main: boolean) {
  if (name.endsWith("/notificationPetIdentity")) return { fetchNotificationPetIdentity: () => identityRead() };
  if (name === "expo-notifications") return notifications;
  return original.call(this, name, parent, main);
};
try {
  const med = require("../../contexts/medication/application/medicationReminderNotifications");
  const meal = require("../../contexts/routine/application/mealReminderNotifications");
  med.setActiveMedicationReminderAccount("u"); meal.setActiveMealReminderAccount("u");
  const schedule = { id: "new", medicationId: "m", medicationName: "Med", dosageLabel: "1", localTime: "08:00", startsOn: "2020-01-01", recurrenceIntervalDays: 1 };
  const medInput = { userId: "u", petId: "a", petName: "A", reminderTitle: "time", schedules: [schedule], previousScheduleIds: ["old"], fromDate: "2026-10-20", identityTimeoutMs: 10 };
  const routine = { petId: "a", food: { meals: { breakfast: { localTime: "08:00" } } }, water: {}, walk: {}, stool: {}, condition: {} };
  const mealInput = { userId: "u", petId: "a", petName: "A", title: "meal", slotLabels: {}, routine, requestPermission: true, identityTimeoutMs: 10 };
  const modes = [async () => null, async () => { throw new Error("offline"); }, () => new Promise(() => undefined)];
  for (const mode of modes) {
    identityRead = mode;
    reset([{ identifier: "medication:u:old:daily", content: { data: { userId: "u", petId: "a", scheduleId: "old" } } }]);
    assert(await bounded(med.rescheduleMedicationReminders(medInput)), "identity failure cannot block medication scheduling");
    assert(installed.length === 1 && canceled.includes("medication:u:old:daily"), "medication replaces previous plan while offline");
    assert(!installed[0].content.data.petCreatedAt, "unavailable identity produces weak payload");
    reset([{ identifier: "meal:u:a:lunch" }]);
    assert(await bounded(meal.rescheduleMealReminders(mealInput)), "identity failure cannot block meal scheduling");
    assert(installed.length === 1 && canceled.includes("meal:u:a:lunch"), "meal replaces previous plan while offline");
  }
  identityRead = async () => ({ petCreatedAt: "pet", schedules: {} }); reset([]);
  assert(await med.rescheduleMedicationReminders(medInput), "new unsynced schedule still schedules");
  assert(installed[0].content.data.petCreatedAt === "pet" && !installed[0].content.data.scheduleCreatedAt, "missing schedule identity weakens only routing");
  identityRead = async () => ({ petCreatedAt: "pet", schedules: { new: "schedule" } }); reset([]);
  await med.rescheduleMedicationReminders(medInput);
  assert(installed[0].content.data.scheduleCreatedAt === "schedule", "ready identity preserves strong routing");
  reset([]); await meal.rescheduleMealReminders(mealInput); assert(installed[0].content.data.petCreatedAt === "pet", "meal preserves ready identity");
  let resolveIdentity!: (value: any) => void;
  identityRead = () => new Promise((resolve) => { resolveIdentity = resolve; }); reset([]);
  await bounded(med.rescheduleMedicationReminders(medInput));
  const calls = installed.length + canceled.length; resolveIdentity({ petCreatedAt: "late", schedules: { new: "late" } }); await flush();
  assert(installed.length + canceled.length === calls && !installed[0].content.data.petCreatedAt, "late identity cannot mutate or reinstall native plans");
  reset([{ identifier: "meal:u:a:breakfast" }]); permissionRequests = 0;
  await bounded(meal.rescheduleMealReminders({ ...mealInput, routine: { ...routine, food: { ...routine.food, mealRemindersEnabled: false } } }));
  assert(installed.length === 0 && canceled.length === 1 && permissionRequests === 0, "disabled meal plan cancels without permission or identity");
  permission = false; reset([]);
  assert(!await med.rescheduleMedicationReminders(medInput) && !await meal.rescheduleMealReminders(mealInput), "denied permission keeps false semantics");
  permission = true; med.setActiveMedicationReminderAccount(null); meal.setActiveMealReminderAccount(null);
  assert(!await med.rescheduleMedicationReminders(medInput) && !await meal.rescheduleMealReminders(mealInput), "inactive account keeps false semantics");
  med.setActiveMedicationReminderAccount("u"); meal.setActiveMealReminderAccount("u");
  identityRead = async () => null; nativeFailure = true;
  await rejects(() => med.rescheduleMedicationReminders(medInput), "native failure"); await rejects(() => meal.rescheduleMealReminders(mealInput), "native failure"); nativeFailure = false;
  reset(Array.from({ length: 60 }, (_, i) => ({ identifier: `other:${i}` })));
  await rejects(() => med.rescheduleMedicationReminders(medInput), "capacity");
} finally { modules._load = original; }
function reset(value: any[]) { pending = value; installed = []; canceled = []; }
async function bounded<T>(promise: Promise<T>): Promise<T> { let timer: ReturnType<typeof setTimeout>; try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("network blocked local scheduling")), 150); })]); } finally { clearTimeout(timer!); } }
async function rejects(run: () => Promise<unknown>, text: string) { let error: unknown; try { await run(); } catch (value) { error = value; } assert(error instanceof Error && error.message.includes(text), `preserves ${text} error`); }
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export {};
