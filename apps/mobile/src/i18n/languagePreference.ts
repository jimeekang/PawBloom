import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { Language } from "../shared-kernel/types";

export const DEFAULT_LANGUAGE: Language = "ko";
export const LANGUAGE_STORAGE_KEY = "pawbloom.language.v1";

export type LanguageStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export type DeviceLocaleReader = () => string | null | undefined;

export async function readLanguagePreference(
  storage: LanguageStorage = deviceLanguageStorage,
  readLocale: DeviceLocaleReader = readDeviceLocale,
): Promise<Language> {
  try {
    const storedLanguage = await storage.getItem(LANGUAGE_STORAGE_KEY);
    if (storedLanguage !== null) {
      return parseLanguage(storedLanguage) ?? DEFAULT_LANGUAGE;
    }
  } catch {
    // Fall through to the current device locale when storage is unavailable.
  }

  return languageFromLocale(readLocale());
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

export function languageFromLocale(locale: string | null | undefined): Language {
  return locale?.trim().toLowerCase().split(/[-_]/)[0] === "ko" ? "ko" : "en";
}

function readDeviceLocale() {
  try {
    const browserLocale = typeof navigator === "undefined" ? null : navigator.languages?.[0] ?? navigator.language;
    return browserLocale ?? Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return null;
  }
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
