import { DEFAULT_MEDICATION_NAME, normalizeMedicationNameForStorage } from "../shared-kernel/recordSentinels";
import { localizedMedicationName } from "./recordDisplay";
import { setRuntimeLanguage } from "./translations";

if (normalizeMedicationNameForStorage("") !== DEFAULT_MEDICATION_NAME || normalizeMedicationNameForStorage("Medication") !== DEFAULT_MEDICATION_NAME || normalizeMedicationNameForStorage("투약") !== DEFAULT_MEDICATION_NAME) {
  throw new Error("empty and legacy quick-medication names must normalize to one language-neutral identifier");
}

if (normalizeMedicationNameForStorage(" Cerenia ") !== "Cerenia") {
  throw new Error("user-entered medication names must be preserved");
}

setRuntimeLanguage("en");
if (localizedMedicationName(DEFAULT_MEDICATION_NAME) !== "Medication" || localizedMedicationName("투약") !== "Medication") {
  throw new Error("English display must localize new and legacy default medication names");
}

setRuntimeLanguage("ko");
if (localizedMedicationName(DEFAULT_MEDICATION_NAME) !== "투약" || localizedMedicationName("Medication") !== "투약") {
  throw new Error("Korean display must localize new and legacy default medication names");
}

if (localizedMedicationName("Cerenia") !== "Cerenia") throw new Error("display localization must preserve a real medication name");
setRuntimeLanguage(null);
