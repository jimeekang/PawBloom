import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { Language } from "../shared-kernel/types";

export const DEFAULT_LANGUAGE: Language = "ko";
export const LANGUAGE_STORAGE_KEY = "pawbloom.language.v1";

export type LanguageStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export async function readLanguagePreference(storage: LanguageStorage = deviceLanguageStorage): Promise<Language> {
  try {
    return parseLanguage(await storage.getItem(LANGUAGE_STORAGE_KEY)) ?? DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
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
