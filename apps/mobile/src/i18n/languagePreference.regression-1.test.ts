import { languageFromLocale, readLanguagePreference, type LanguageStorage } from "./languagePreference";

// Regression: UX-001 — first-run users were forced into Korean before authentication
// Found by /qa on 2026-07-16
// Report: .gstack/qa-reports/qa-report-pawbloom-ui-ux-2026-07-16.md

const emptyStorage: LanguageStorage = {
  getItem: async () => null,
  setItem: async () => undefined,
};

if (await readLanguagePreference(emptyStorage, () => "en-AU") !== "en") {
  throw new Error("first-run Australian devices must start in English");
}

if (await readLanguagePreference(emptyStorage, () => "ko-KR") !== "ko") {
  throw new Error("first-run Korean devices must start in Korean");
}

if (languageFromLocale("fr-FR") !== "en" || languageFromLocale(null) !== "en") {
  throw new Error("unsupported or unavailable device locales must fall back to English");
}
