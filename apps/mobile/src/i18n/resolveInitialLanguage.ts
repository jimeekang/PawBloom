import type { Language } from "../shared-kernel/types";

// Pure resolver shared by the initial context state and the stored-preference read.
// A stored user preference always wins so existing users keep their choice. Only
// when nothing is stored does the device language decide: Korean stays Korean and
// everything else (including an unknown locale) defaults to English so an overseas
// reviewer never lands on a Korean UI on first launch.
export function resolveInitialLanguage(stored: Language | null, deviceLanguageCode: string | undefined): Language {
  if (stored) return stored;
  return deviceLanguageCode === "ko" ? "ko" : "en";
}
