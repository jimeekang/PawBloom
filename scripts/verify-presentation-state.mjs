import { createRequire } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, relative } from "node:path";

const require = createRequire(import.meta.url);
const ts = require(join(process.cwd(), "apps/mobile/node_modules/typescript"));
const root = process.cwd();
const testTimeoutMs = positiveInteger(process.env.PAWBLOOM_TEST_TIMEOUT_MS, 15_000);
const childTimeoutMs = Math.max(1, testTimeoutMs - 1_000);

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

const tests = findTestFiles(join(root, "apps/mobile/src"));
const testRunner = join(root, "scripts/run-presentation-test.mjs");
const testFailures = [];

for (const test of tests) {
  const testPath = relative(root, test).replaceAll("\\", "/");
  const result = spawnSync(process.execPath, [testRunner, testPath], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, PAWBLOOM_TEST_FILE_TIMEOUT_MS: String(childTimeoutMs) },
    killSignal: "SIGKILL",
    maxBuffer: 4 * 1024 * 1024,
    timeout: testTimeoutMs,
  });

  if (result.error?.code === "ETIMEDOUT") {
    testFailures.push(`TIMEOUT ${testPath}: exceeded ${testTimeoutMs}ms; child process was terminated.`);
    continue;
  }

  if (result.error) {
    testFailures.push(`RUNNER ERROR ${testPath}: ${result.error.message}`);
    continue;
  }

  if (result.status !== 0) {
    testFailures.push([result.stdout, result.stderr].filter(Boolean).join("\n").trim() || `${testPath} exited with status ${result.status}`);
  }
}

if (testFailures.length) {
  throw new Error(`Presentation tests failed (${testFailures.length}/${tests.length}):\n${testFailures.join("\n\n")}`);
}

const homeScreen = readFileSync(join(root, "apps/mobile/src/presentation/screens/HomeScreen.tsx"), "utf8");
if (homeScreen.includes("pet.diaryMode") || homeScreen.includes("pet.careMode")) {
  throw new Error("home screen must not show Diary mode or Care mode buttons");
}

const careModeScreen = readFileSync(join(root, "apps/mobile/src/presentation/screens/CareModeScreen.tsx"), "utf8");
if (careModeScreen.includes("CareRecordPanel")) {
  throw new Error("care screen must not include the duplicate care record input panel");
}

if (!careModeScreen.includes("CareMedicationAddCard")) {
  throw new Error("care screen must include the add-medication entry point in the primary care flow");
}

const careMedicationAddCard = readFileSync(join(root, "apps/mobile/src/presentation/screens/CareMedicationAddCard.tsx"), "utf8");
if (!careMedicationAddCard.includes("ShortTermMedicationForm")) {
  throw new Error("add-medication card must keep care plan creation (short-term course) reachable from the care flow");
}

const diaryDetailPanel = readFileSync(join(root, "apps/mobile/src/contexts/diary/ui/DiaryDetailPanel.tsx"), "utf8");
if (/\n\s*mealRow:\s*{[^}]*flexDirection:\s*"row"/s.test(diaryDetailPanel) || /\n\s*mealLabel:\s*{[^}]*width:\s*42/s.test(diaryDetailPanel)) {
  throw new Error("diary food meal fields must remain stacked to avoid narrow mobile clipping");
}

const careMedicationPanel = readFileSync(join(root, "apps/mobile/src/contexts/medication/ui/CareMedicationPanel.tsx"), "utf8");
if (/\n\s*inputStack:\s*{\s*flexDirection:\s*"row"/s.test(careMedicationPanel)) {
  throw new Error("care quick medication dose fields must remain stacked to avoid narrow mobile clipping");
}

const shortTermMedicationForm = readFileSync(join(root, "apps/mobile/src/contexts/care/ui/ShortTermMedicationForm.tsx"), "utf8");
if (/\n\s*panel:\s*{[^}]*flexDirection:\s*"row"/s.test(shortTermMedicationForm)) {
  throw new Error("short-term medication fields must remain stacked to avoid narrow mobile clipping");
}

if (!shortTermMedicationForm.includes("DatePickerField")) {
  throw new Error("short-term medication course period must use native date picker controls");
}

const profileCareDefaultsPanel = readFileSync(join(root, "apps/mobile/src/contexts/care/ui/ProfileCareDefaultsPanel.tsx"), "utf8");
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

function findTestFiles(directory) {
  return readdirSync(directory)
    .flatMap((entry) => {
      const path = join(directory, entry);
      return statSync(path).isDirectory() ? findTestFiles(path) : [path];
    })
    .filter((path) => /\.test\.(ts|tsx)$/.test(path))
    .sort();
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
