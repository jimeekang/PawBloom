declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

// Regression: UX-007C — common disclosures, segments, schedules, and photo controls hid their state
// Found by /qa on 2026-07-16
// Report: .gstack/qa-reports/qa-report-pawbloom-ui-ux-2026-07-16.md

function read(path: string) {
  return readFileSync(`${process.cwd()}/apps/mobile/src/${path}`, "utf8");
}

const components = read("design-system/components.tsx");
const timePicker = read("design-system/TimePickerField.tsx");
const homePanel = read("presentation/screens/HomeDashboardPanel.tsx");
const care = read("presentation/screens/CareModeScreen.tsx");
const photos = read("contexts/diary/ui/DiaryPhotoPicker.tsx");

if (!components.includes('accessibilityRole="radio"') || !components.includes("aria-checked={value === item.value}")) {
  throw new Error("segmented controls must expose one checked option");
}

if (!timePicker.includes("aria-expanded={open}") || !homePanel.includes("aria-expanded={expanded}")) {
  throw new Error("time and care summary disclosures must expose expanded state");
}

if (!care.includes("accessibilityState={{ disabled: !canManageCare }}")) {
  throw new Error("care schedule actions must announce their disabled state");
}

if (!photos.includes("diary.photoRemoveA11y")) {
  throw new Error("Diary photo remove actions must have an explicit name");
}
