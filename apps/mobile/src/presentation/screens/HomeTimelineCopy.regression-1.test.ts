import { translations } from "../../i18n/translations";

// Simulator regression: the Today list contains diary rows only. Medication
// feedback must not claim that this diary-only list was updated.
if (!translations.en["today.timeline.full"].toLowerCase().includes("diary")) {
  throw new Error("the Today list must identify itself as diary records");
}

if (/timeline/i.test(translations.en["feedback.medicationStatusMessage"])) {
  throw new Error("medication status feedback must describe the medication record, not the diary timeline");
}

if (translations.ko["feedback.medicationStatusMessage"].includes("타임라인")) {
  throw new Error("Korean medication feedback must not claim the diary timeline changed");
}
