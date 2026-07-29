declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

// Regression: 0006 B5/B9 — reminder side effects must not fire where they
// cannot work: preview/web saves skip the reminder notice entirely (no false
// "permission needed" error), and saving with meal reminders disabled must
// not pop the OS permission dialog.

function read(path: string) {
  return readFileSync(`${process.cwd()}/apps/mobile/src/${path}`, "utf8");
}

function occurrences(source: string, needle: string) {
  return source.split(needle).length - 1;
}

const shell = read("presentation/PawBloomShell.tsx");
const mealReminders = read("contexts/routine/application/mealReminderNotifications.ts");

// The care path also gates on the reminder preference; the toggle itself moved
// to useMedicationReminderToggle with the same guard.
if (!shell.includes('if (!databaseMode || !userId || Platform.OS === "web" || !medicationRemindersEnabled) return savedSetup;')
  || occurrences(shell, 'if (!databaseMode || !userId || Platform.OS === "web")') < 1) {
  throw new Error("both care and routine save paths must skip reminder notices in preview/web mode (B5)");
}

const planIndex = mealReminders.indexOf("const plan = buildMealReminderPlan");
const permissionIndex = mealReminders.indexOf("requestPermissionsAsync");
if (planIndex === -1 || permissionIndex === -1 || planIndex > permissionIndex) {
  throw new Error("rescheduleMealReminders must build the plan before requesting notification permission (B9)");
}

if (!mealReminders.includes("if (plan.length > 0)")) {
  throw new Error("an empty meal reminder plan (reminders disabled) must skip the OS permission request (B9)");
}

if (!shell.includes("petSettingsNotice")) {
  throw new Error(
    "the pet settings screen must render the shell notice banner — reminder toggle/save feedback (permission denied etc.) was invisible there (Phase B review finding)",
  );
}

type TestSchedule = {
  id: string; medicationId: string; medicationName: string; dosageLabel: string;
  localTime: string; startsOn: string; recurrenceIntervalDays: number;
};
type TestPet = { id: string; name: string };
type ToggleInput = {
  enabled: boolean; databaseMode: boolean; userId: string | null; activePet: TestPet;
  pets: TestPet[]; activePetSchedules: TestSchedule[];
};
type RestoreInput = Omit<ToggleInput, "enabled" | "databaseMode"> & { userId: string; activePetId: string };
type ScheduledNotification = { identifier: string; content?: { data?: Record<string, unknown> } };

const notificationState = {
  granted: true,
  pending: [] as ScheduledNotification[],
  scheduled: [] as Array<{ identifier: string; content: { data?: Record<string, unknown> } }>,
  cancelled: [] as string[],
};
const notificationsMock = {
  SchedulableTriggerInputTypes: { DAILY: "daily", DATE: "date" },
  requestPermissionsAsync: async () => ({ granted: notificationState.granted }),
  getPermissionsAsync: async () => ({ granted: notificationState.granted }),
  getAllScheduledNotificationsAsync: async () => [...notificationState.pending],
  cancelScheduledNotificationAsync: async (identifier: string) => {
    notificationState.cancelled.push(identifier);
    notificationState.pending = notificationState.pending.filter((item) => item.identifier !== identifier);
  },
  scheduleNotificationAsync: async (request: { identifier: string; content: { data?: Record<string, unknown> } }) => {
    notificationState.scheduled.push(request);
    notificationState.pending.push({ identifier: request.identifier, content: request.content });
    return request.identifier;
  },
};

const nodeModule = require("node:module") as { _load: (request: string, parent?: unknown, isMain?: boolean) => unknown };
const originalModuleLoad = nodeModule._load;
nodeModule._load = function loadWithNotificationMock(request, parent, isMain) {
  if (request === "expo-notifications") return notificationsMock;
  return originalModuleLoad.call(this, request, parent, isMain);
};

try {
  await verifyMedicationReminderToggleBehavior();
} finally {
  nodeModule._load = originalModuleLoad;
}

async function verifyMedicationReminderToggleBehavior() {
  const { applyMedicationReminderToggle } = require("./useMedicationReminderToggle") as {
    applyMedicationReminderToggle: (input: ToggleInput, dependencies?: Record<string, unknown>) => Promise<string>;
  };
  const { restoreMedicationRemindersForPets } = require("./medicationReminderRestore") as {
    restoreMedicationRemindersForPets: (input: RestoreInput, dependencies?: Record<string, unknown>) => Promise<"scheduled" | "denied">;
  };
  const { cancelMedicationRemindersForAccount, setActiveMedicationReminderAccount } = require("../../contexts/medication/application/medicationReminderNotifications") as {
    cancelMedicationRemindersForAccount: (userId: string) => Promise<void>;
    setActiveMedicationReminderAccount: (userId: string | null) => void;
  };
  const activeSchedule = schedule("schedule-a", "Medicine A");
  const otherSchedule = schedule("schedule-b", "Medicine B");
  const toggleInput: ToggleInput = {
    enabled: false,
    databaseMode: true,
    userId: "account-a",
    activePet: { id: "pet-a", name: "Alpha" },
    pets: [{ id: "pet-a", name: "Alpha" }, { id: "pet-b", name: "Beta" }, { id: "pet-a", name: "Alpha" }],
    activePetSchedules: [activeSchedule],
  };

  resetNotifications(true, [
    notification("account-a-a", "account-a", "pet-a"),
    notification("account-a-b", "account-a", "pet-b"),
    notification("account-b", "account-b", "pet-b"),
  ]);
  const cancelledAccounts: string[] = [];
  const offOutcome = await applyMedicationReminderToggle(toggleInput, {
    platformOS: "ios",
    cancelForAccount: async (userId: string) => {
      cancelledAccounts.push(userId);
      await cancelMedicationRemindersForAccount(userId);
    },
  });
  assert(offOutcome === "cancelled" && cancelledAccounts.join() === "account-a", "toggle-off must call account-wide cancellation with the signed-in user id");
  assert(notificationState.cancelled.sort().join() === "medication:account-a-a,medication:account-a-b", "toggle-off must cancel every pet reminder owned by the account");
  assert(notificationState.pending.some((item) => item.identifier === "medication:account-b"), "toggle-off must preserve another account's reminders");

  resetNotifications(true);
  setActiveMedicationReminderAccount("account-a");
  const fetchedPetIds: string[] = [];
  const onOutcome = await applyMedicationReminderToggle({ ...toggleInput, enabled: true }, {
    platformOS: "ios",
    restoreForPets: (input: RestoreInput) => restoreMedicationRemindersForPets(input, {
      fetchSchedulesForPet: async (petId: string) => {
        fetchedPetIds.push(petId);
        return petId === "pet-b" ? [otherSchedule] : [];
      },
    }),
  });
  const scheduledPetIds = notificationState.scheduled.map((item) => String(item.content.data?.petId)).sort();
  assert(onOutcome === "scheduled" && scheduledPetIds.join() === "pet-a,pet-b", "toggle-on must restore reminders for every pet with schedules, not only the active pet");
  assert(fetchedPetIds.join() === "pet-b", "restore must reuse active schedules and fetch each other unique pet");

  resetNotifications(false);
  setActiveMedicationReminderAccount("account-a");
  const deniedOutcome = await applyMedicationReminderToggle({ ...toggleInput, enabled: true }, {
    platformOS: "ios",
    restoreForPets: (input: RestoreInput) => restoreMedicationRemindersForPets(input, { fetchSchedulesForPet: async () => [otherSchedule] }),
  });
  assert(deniedOutcome === "denied" && notificationState.scheduled.length === 0, "permission denial must not install reminders and must reach the hook's denied feedback branch");
  setActiveMedicationReminderAccount(null);
}

function schedule(id: string, medicationName: string): TestSchedule {
  return { id, medicationId: `medication-${id}`, medicationName, dosageLabel: "1 tablet", localTime: "08:00", startsOn: "2020-01-01", recurrenceIntervalDays: 1 };
}

function notification(id: string, userId: string, petId: string): ScheduledNotification {
  return { identifier: `medication:${id}`, content: { data: { userId, petId, scheduleId: id } } };
}

function resetNotifications(granted: boolean, pending: ScheduledNotification[] = []) {
  notificationState.granted = granted;
  notificationState.pending = [...pending];
  notificationState.scheduled = [];
  notificationState.cancelled = [];
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
