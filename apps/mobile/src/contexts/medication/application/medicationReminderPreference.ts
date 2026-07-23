import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Device-local switch for medication reminders (0006 B7). Local notifications
// are scheduled per device, so the off switch lives on the device too — no
// care-plan schema change needed. Default is on.
export const MEDICATION_REMINDERS_STORAGE_KEY = "pawbloom.medicationReminders.v1";

export type PreferenceStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export function parseMedicationRemindersEnabled(stored: string | null): boolean {
  return stored !== "off";
}

export async function readMedicationRemindersEnabled(storage: PreferenceStorage = preferenceStorage): Promise<boolean> {
  try {
    return parseMedicationRemindersEnabled(await storage.getItem(MEDICATION_REMINDERS_STORAGE_KEY));
  } catch {
    return true;
  }
}

export async function writeMedicationRemindersEnabled(enabled: boolean, storage: PreferenceStorage = preferenceStorage): Promise<void> {
  try {
    await storage.setItem(MEDICATION_REMINDERS_STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Best-effort persistence; scheduling honors the in-memory state this session.
  }
}

const preferenceStorage: PreferenceStorage = Platform.OS === "web"
  ? {
      getItem: async (key) => {
        try {
          return globalThis.localStorage?.getItem(key) ?? null;
        } catch {
          return null;
        }
      },
      setItem: async (key, value) => {
        try {
          globalThis.localStorage?.setItem(key, value);
        } catch {
          // Restricted webviews and private browsing can disable localStorage.
        }
      },
    }
  : {
      getItem: (key) => SecureStore.getItemAsync(key),
      setItem: (key, value) => SecureStore.setItemAsync(key, value),
    };
