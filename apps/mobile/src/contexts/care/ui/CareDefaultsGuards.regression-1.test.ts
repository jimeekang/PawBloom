declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

// Regression: 0006 B6/B7 — the care defaults panel must reject an inverted
// schedule period (which silently disables the schedule everywhere), and the
// medication reminder toggle must stay wired from panel to scheduler.

function read(path: string) {
  return readFileSync(`${process.cwd()}/apps/mobile/src/${path}`, "utf8");
}

function occurrences(source: string, needle: string) {
  return source.split(needle).length - 1;
}

const panel = read("contexts/care/ui/ProfileCareDefaultsPanel.tsx");
const shell = read("presentation/PawBloomShell.tsx");
const scheduling = read("presentation/shell/reminderScheduling.ts");
const translations = read("i18n/translations.ts");

if (!panel.includes("isCareSetupPeriodInvalid") || !panel.includes("care.shortTermPeriodInvalid")) {
  throw new Error("ProfileCareDefaultsPanel must block an end date before the start date with the shared period copy (B6)");
}

if (!panel.includes("onToggleMedicationReminders") || !panel.includes("care.medicationRemindersLabel")) {
  throw new Error("ProfileCareDefaultsPanel must expose the medication reminders toggle (B7)");
}

// The preference load + account-wide cancel moved into the toggle hook the
// shell mounts; the guarantee follows the code.
const reminderToggleHook = read("presentation/shell/useMedicationReminderToggle.ts");
if (!shell.includes("useMedicationReminderToggle")
  || !reminderToggleHook.includes("readMedicationRemindersEnabled")
  || !reminderToggleHook.includes("cancelMedicationRemindersForAccount")
  || !reminderToggleHook.includes("restoreMedicationRemindersForPets")) {
  throw new Error("the shell must load the reminder preference, cancel on toggle-off, and restore every pet on toggle-on (B7/0007 B2)");
}

if (!scheduling.includes("medicationRemindersEnabled")) {
  throw new Error("useReminderAutoRefresh must honor the medication reminder preference instead of always rescheduling (B7)");
}

for (const key of ['"care.medicationRemindersLabel"']) {
  if (occurrences(translations, key) < 2) {
    throw new Error(`${key} must be defined in both en and ko translations`);
  }
}
