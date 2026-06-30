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
  "apps/mobile/src/presentation/liveUiState.dashboard.test.ts",
  "apps/mobile/src/presentation/screens/DiaryEntryScreen.test.ts",
  "apps/mobile/src/presentation/ui/TimePickerField.test.ts",
  "apps/mobile/src/presentation/shell/checklistActions.test.ts",
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
