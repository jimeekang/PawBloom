declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

// Regression: UX-007A — Home and Diary controls exposed no selected state or useful names
// Found by /qa on 2026-07-16
// Report: .gstack/qa-reports/qa-report-pawbloom-ui-ux-2026-07-16.md

function read(path: string) {
  return readFileSync(`${process.cwd()}/apps/mobile/src/${path}`, "utf8");
}

const home = read("presentation/screens/HomeScreen.tsx");
const categories = read("contexts/diary/ui/DiaryCategoryPicker.tsx");
const score = read("contexts/diary/ui/DiaryConditionScore.tsx");
const entries = read("contexts/diary/ui/DiaryEntryList.tsx");

if (!home.includes('accessibilityRole="checkbox"') || !home.includes("aria-checked={done}") || !home.includes("today.checklistStatusComplete")) {
  throw new Error("Home checklist actions must expose their recorded state and an explicit label");
}

if (!home.includes("accessibilityLabel={`${entry.occurredAt}")) {
  throw new Error("Home timeline actions must announce time, category, and summary");
}

if (!categories.includes('accessibilityRole="radio"') || !categories.includes("aria-checked={active}")) {
  throw new Error("Diary categories must expose radio semantics and checked state");
}

if (!score.includes('accessibilityRole="radio"') || !score.includes("aria-checked={value === score}")) {
  throw new Error("Diary condition scores must expose radio semantics and checked state");
}

if (!entries.includes('accessibilityLabel={t("ko", "diary.photoClose")}')) {
  throw new Error("the Diary photo viewer must provide a close action name");
}
