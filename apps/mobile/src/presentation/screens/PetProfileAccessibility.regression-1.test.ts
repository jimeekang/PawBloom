declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

// Regression: UX-007B / UX-008 — Pet profile inputs relied on placeholders and selections had no state
// Found by /qa on 2026-07-16
// Report: .gstack/qa-reports/qa-report-pawbloom-ui-ux-2026-07-16.md

function read(path: string) {
  return readFileSync(`${process.cwd()}/apps/mobile/src/${path}`, "utf8");
}

const screen = read("presentation/screens/PetOnboardingScreen.tsx");
const helpers = read("presentation/screens/PetOnboardingHelpers.tsx");
const datePicker = read("design-system/DatePickerField.tsx");
const shellHeaders = read("presentation/shell/ShellHeaders.tsx");

for (const key of ["pet.nameLabel", "pet.breedLabel", "pet.birthdateLabel", "pet.weightLabel"]) {
  if (!screen.includes(key)) throw new Error(`Pet profile must render the visible field label ${key}`);
}

if (!helpers.includes('accessibilityRole="radio"') || !helpers.includes("aria-checked={pet.id === activePetId}")) {
  throw new Error("Pet selection must expose radio semantics and checked state");
}

if (!helpers.includes("accessibilityLabel={label}") || !helpers.includes("aria-checked={selected}")) {
  throw new Error("Pet field helpers must name inputs and expose species selection state");
}

if (!datePicker.includes("aria-expanded={open}") || !datePicker.includes('accessibilityRole="button"')) {
  throw new Error("Date picker and clear controls must expose button semantics and open state");
}

if (!shellHeaders.includes('accessibilityLabel={label}') || !shellHeaders.includes('"navigation.back"')) {
  throw new Error("icon-only Diary and Pet profile back buttons must have a localized accessible name");
}
