import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { Language } from "../shared-kernel/types";
import { readDeviceLanguageCode } from "./deviceLanguage";
import { resolveInitialLanguage } from "./resolveInitialLanguage";

export const LANGUAGE_STORAGE_KEY = "pawbloom.language.v1";

export type LanguageStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

type DeviceLanguageReader = () => string | undefined;

// Synchronous best guess for the initial render, before the stored preference has
// loaded. Nothing is stored yet, so this is purely device-locale driven.
export function getInitialLanguage(readDeviceLanguage: DeviceLanguageReader = readDeviceLanguageCode): Language {
  return resolveInitialLanguage(null, safeDeviceLanguageCode(readDeviceLanguage));
}

export async function readLanguagePreference(
  storage: LanguageStorage = deviceLanguageStorage,
  readDeviceLanguage: DeviceLanguageReader = readDeviceLanguageCode,
): Promise<Language> {
  let stored: Language | null = null;
  try {
    stored = parseLanguage(await storage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    stored = null;
  }
  return resolveInitialLanguage(stored, safeDeviceLanguageCode(readDeviceLanguage));
}

function safeDeviceLanguageCode(readDeviceLanguage: DeviceLanguageReader): string | undefined {
  try {
    return readDeviceLanguage();
  } catch {
    return undefined;
  }
}

export async function writeLanguagePreference(language: Language, storage: LanguageStorage = deviceLanguageStorage): Promise<void> {
  try {
    await storage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Language changes still apply for this session when device storage is unavailable.
  }
}

export function parseLanguage(value: string | null | undefined): Language | null {
  return value === "ko" || value === "en" ? value : null;
}

const deviceLanguageStorage: LanguageStorage = Platform.OS === "web"
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
