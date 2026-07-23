import { getInitialLanguage, readLanguagePreference, writeLanguagePreference, LANGUAGE_STORAGE_KEY, parseLanguage, type LanguageStorage } from "./languagePreference";
import { setRuntimeLanguage, t } from "./translations";

const values = new Map<string, string>();
const storage: LanguageStorage = {
  getItem: async (key) => values.get(key) ?? null,
  setItem: async (key, value) => {
    values.set(key, value);
  },
};

const koDevice = () => "ko";
const enDevice = () => "en";
const noDevice = () => undefined;

// A stored preference always wins, even against a conflicting device locale, so existing users see no change.
values.set(LANGUAGE_STORAGE_KEY, "en");
if (await readLanguagePreference(storage, koDevice) !== "en") throw new Error("saved English preference must win over a Korean device locale");
values.set(LANGUAGE_STORAGE_KEY, "ko");
if (await readLanguagePreference(storage, enDevice) !== "ko") throw new Error("saved Korean preference must win over an English device locale");

// With no valid stored preference the device locale drives the default (Korean device → Korean, otherwise English).
values.set(LANGUAGE_STORAGE_KEY, "unsupported");
if (await readLanguagePreference(storage, koDevice) !== "ko") throw new Error("no stored preference + Korean device must resolve to Korean");
if (await readLanguagePreference(storage, noDevice) !== "en") throw new Error("no stored preference + unknown device locale must resolve to English");

// The synchronous initial guess has no stored preference yet, so it is purely device driven.
if (getInitialLanguage(koDevice) !== "ko") throw new Error("initial language must follow a Korean device locale");
if (getInitialLanguage(enDevice) !== "en") throw new Error("initial language must follow an English device locale");
if (getInitialLanguage(noDevice) !== "en") throw new Error("initial language must default to English for an unknown device locale");

if (parseLanguage("en") !== "en" || parseLanguage("ko") !== "ko" || parseLanguage("fr") !== null) {
  throw new Error("language parsing must allow only supported locales");
}

await writeLanguagePreference("en", storage);
if (values.get(LANGUAGE_STORAGE_KEY) !== "en") throw new Error("language changes must persist");

setRuntimeLanguage("en");
if (t("ko", "tabs.settings") !== "Settings") throw new Error("runtime language must update hard-coded legacy translation calls");
setRuntimeLanguage("ko");
if (t("en", "tabs.settings") !== "설정") throw new Error("runtime Korean must update the full app tree");
setRuntimeLanguage(null);
if (t("en", "tabs.settings") !== "Settings") throw new Error("pure translation calls must retain explicit-language behavior outside the provider");
