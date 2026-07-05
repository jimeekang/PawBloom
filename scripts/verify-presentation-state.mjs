import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const ts = require(join(process.cwd(), "apps/mobile/node_modules/typescript"));
const root = process.cwd();

const transpileTypeScriptModule = (module, filename) => {
  const source = require("node:fs").readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });

  module._compile(output.outputText, filename);
};

require.extensions[".ts"] = transpileTypeScriptModule;
require.extensions[".tsx"] = transpileTypeScriptModule;

const tests = [
  "apps/mobile/src/contexts/diary/application/diaryRecordOrigin.test.ts",
  "apps/mobile/src/contexts/diary/application/diaryRecordPayload.test.ts",
  "apps/mobile/src/contexts/diary/application/diaryWalkObservationSummary.test.ts",
  "apps/mobile/src/contexts/medication/application/medicationScheduleRules.test.ts",
  "apps/mobile/src/contexts/medication/application/medicationScheduleRecords.test.ts",
  "apps/mobile/src/contexts/medication/application/medicationDoseRecords.scheduleGuard.test.ts",
  "apps/mobile/src/presentation/liveUiState.dashboard.test.ts",
  "apps/mobile/src/presentation/screens/HomeDashboardPanel.logic.test.ts",
  "apps/mobile/src/presentation/screens/todayMedicationAgenda.test.ts",
  "apps/mobile/src/presentation/notifications/medicationReminderNotifications.test.ts",
  "apps/mobile/src/presentation/screens/ProfileCareDefaultsPanel.test.tsx",
  "apps/mobile/src/presentation/screens/CareMedicationPanel.test.tsx",
  "apps/mobile/src/presentation/screens/DiaryEntryScreen.test.ts",
  "apps/mobile/src/presentation/ui/TimePickerField.test.ts",
  "apps/mobile/src/presentation/shell/checklistActions.test.ts",
  "apps/mobile/src/presentation/shell/checklistNotice.test.ts",
  "apps/mobile/src/presentation/shell/timelineRouting.test.ts",
];

for (const test of tests) {
  require(join(root, test));
}

const homeScreen = readFileSync(join(root, "apps/mobile/src/presentation/screens/HomeScreen.tsx"), "utf8");
if (homeScreen.includes("pet.diaryMode") || homeScreen.includes("pet.careMode")) {
  throw new Error("home screen must not show Diary mode or Care mode buttons");
}

const careModeScreen = readFileSync(join(root, "apps/mobile/src/presentation/screens/CareModeScreen.tsx"), "utf8");
if (careModeScreen.includes("CareRecordPanel")) {
  throw new Error("care screen must not include the duplicate care record input panel");
}

if (!careModeScreen.includes("CareSetupPanel")) {
  throw new Error("care screen must include care plan creation UI in the primary care flow");
}

const diaryDetailPanel = readFileSync(join(root, "apps/mobile/src/presentation/screens/DiaryDetailPanel.tsx"), "utf8");
if (/\n\s*mealRow:\s*{[^}]*flexDirection:\s*"row"/s.test(diaryDetailPanel) || /\n\s*mealLabel:\s*{[^}]*width:\s*42/s.test(diaryDetailPanel)) {
  throw new Error("diary food meal fields must remain stacked to avoid narrow mobile clipping");
}

const careMedicationPanel = readFileSync(join(root, "apps/mobile/src/presentation/screens/CareMedicationPanel.tsx"), "utf8");
if (/\n\s*inputGrid:\s*{\s*flexDirection:\s*"row"/s.test(careMedicationPanel)) {
  throw new Error("care quick medication dose fields must remain stacked to avoid narrow mobile clipping");
}

const careSetupPanel = readFileSync(join(root, "apps/mobile/src/presentation/screens/CareSetupPanel.tsx"), "utf8");
if (/\n\s*row:\s*{\s*flexDirection:\s*"row"/s.test(careSetupPanel) || /\n\s*timePicker:\s*{\s*width:\s*112/s.test(careSetupPanel)) {
  throw new Error("care setup medication and time fields must remain stacked to avoid narrow mobile clipping");
}

if (!careSetupPanel.includes("DatePickerField")) {
  throw new Error("care setup treatment period must use native date picker controls");
}

const profileCareDefaultsPanel = readFileSync(join(root, "apps/mobile/src/presentation/screens/ProfileCareDefaultsPanel.tsx"), "utf8");
if (!profileCareDefaultsPanel.includes("DatePickerField")) {
  throw new Error("profile care treatment period must use native date picker controls");
}

if (profileCareDefaultsPanel.includes('placeholder="YYYY-MM-DD"') || profileCareDefaultsPanel.includes("pet.careDefaultsEveryTwoDays")) {
  throw new Error("profile care period and recurrence must not use manual date text fields or fixed 2-day recurrence");
}

const bottomNav = readFileSync(join(root, "apps/mobile/src/presentation/ui/BottomNav.tsx"), "utf8");
if (!bottomNav.includes('"settings"') || !bottomNav.includes('"tabs.settings"')) {
  throw new Error("settings must be a bottom navigation tab beside reports");
}

const shellHeaders = readFileSync(join(root, "apps/mobile/src/presentation/shell/ShellHeaders.tsx"), "utf8");
if (shellHeaders.includes('name="menu"') || shellHeaders.includes('name="settings" size={iconSize.lg} color={colors.text}')) {
  throw new Error("settings entry must not remain as a right-side header icon");
}

const { t } = require(join(root, "apps/mobile/src/i18n/translations.ts"));
const careEyebrowKo = t("ko", "care.eyebrow");
const careEyebrowEn = t("en", "care.eyebrow");
const careCopyKo = t("ko", "care.copy");
const careCopyEn = t("en", "care.copy");

if (careEyebrowKo.includes("모드") || careCopyKo.includes("모드")) {
  throw new Error("Korean care screen wording must describe care records, not a mode");
}

if (/mode/i.test(careEyebrowEn) || /mode/i.test(careCopyEn)) {
  throw new Error("English care screen wording must describe care records, not a mode");
}

console.log(`Presentation state verification passed (${tests.length} test file checked, wording checked).`);
