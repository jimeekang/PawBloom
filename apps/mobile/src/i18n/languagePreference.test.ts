import { readLanguagePreference, writeLanguagePreference, LANGUAGE_STORAGE_KEY, parseLanguage, type LanguageStorage } from "./languagePreference";
import { setRuntimeLanguage, t } from "./translations";

const values = new Map<string, string>();
const storage: LanguageStorage = {
  getItem: async (key) => values.get(key) ?? null,
  setItem: async (key, value) => {
    values.set(key, value);
  },
};

values.set(LANGUAGE_STORAGE_KEY, "en");
if (await readLanguagePreference(storage) !== "en") throw new Error("saved English preference must be restored");
values.set(LANGUAGE_STORAGE_KEY, "unsupported");
if (await readLanguagePreference(storage) !== "ko") throw new Error("invalid preferences must fall back to Korean");
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
