import { parseMedicationRemindersEnabled, readMedicationRemindersEnabled, writeMedicationRemindersEnabled, MEDICATION_REMINDERS_STORAGE_KEY } from "./medicationReminderPreference";

if (!parseMedicationRemindersEnabled(null)) {
  throw new Error("medication reminders must default to enabled when nothing is stored");
}
if (!parseMedicationRemindersEnabled("on") || parseMedicationRemindersEnabled("off")) {
  throw new Error("stored on/off values must round-trip");
}

const store = new Map<string, string>();
const memoryStorage = {
  getItem: async (key: string) => store.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    store.set(key, value);
  },
};

void (async () => {
  await writeMedicationRemindersEnabled(false, memoryStorage);
  if (store.get(MEDICATION_REMINDERS_STORAGE_KEY) !== "off" || (await readMedicationRemindersEnabled(memoryStorage)) !== false) {
    throw new Error("disabling must persist and read back as off");
  }

  await writeMedicationRemindersEnabled(true, memoryStorage);
  if ((await readMedicationRemindersEnabled(memoryStorage)) !== true) {
    throw new Error("re-enabling must read back as on");
  }

  const failingStorage = {
    getItem: async () => {
      throw new Error("storage unavailable");
    },
    setItem: async () => {
      throw new Error("storage unavailable");
    },
  };
  if ((await readMedicationRemindersEnabled(failingStorage)) !== true) {
    throw new Error("storage failures must fall back to enabled, never silently mute reminders");
  }
})();
