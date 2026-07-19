import { Platform } from "react-native";
import type * as LocalizationModule from "expo-localization";

// expo-localization's getLocales() is a native module, so it stays behind this
// platform/IO boundary. resolveInitialLanguage stays pure and importable without it.
// Any failure resolves to `undefined`, which the pure resolver treats as English.
export function readDeviceLanguageCode(): string | undefined {
  try {
    if (Platform.OS === "web") {
      return normalizeLanguageCode(globalThis.navigator?.language);
    }
    const Localization = require("expo-localization") as typeof LocalizationModule;
    return normalizeLanguageCode(Localization.getLocales()[0]?.languageCode);
  } catch {
    return undefined;
  }
}

// Reduce a BCP-47 tag ("ko-KR", "en-AU") to its base language subtag ("ko", "en").
function normalizeLanguageCode(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.split("-")[0].toLowerCase();
}
