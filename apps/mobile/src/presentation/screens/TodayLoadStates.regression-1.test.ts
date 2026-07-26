declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

// Regression: 0006 B2/B3/B4 — query failures must never masquerade as empty
// states. Home, care, and report screens surface loading and error (with
// retry), and checklist taps are blocked while today's records are loading.

function read(path: string) {
  return readFileSync(`${process.cwd()}/apps/mobile/src/${path}`, "utf8");
}

function occurrences(source: string, needle: string) {
  return source.split(needle).length - 1;
}

const homeScreen = read("presentation/screens/HomeScreen.tsx");
const careScreen = read("presentation/screens/CareModeScreen.tsx");
const reportsScreen = read("contexts/report/ui/ReportsScreen.tsx");
const reportDraft = read("contexts/report/application/reportDraftRecords.ts");
const shell = read("presentation/PawBloomShell.tsx");
const translations = read("i18n/translations.ts");

if (!homeScreen.includes("today.loadFailed") || !homeScreen.includes('todayStatus !== "ready"')) {
  throw new Error("HomeScreen must show a load-failure state and block checklist taps until today's records are ready");
}

if (!careScreen.includes("care.loadFailed") || !careScreen.includes("onRetryCare")) {
  throw new Error("CareModeScreen must show a load-failure state with retry instead of the empty medication copy");
}

if (!reportsScreen.includes("sourceStatus") || !reportDraft.includes("sourceStatus")) {
  throw new Error("Report draft summary must expose source query status so failures do not render as the 7-day empty state");
}

if (!shell.includes("todayStatus=") || !shell.includes("careStatus=")) {
  throw new Error("PawBloomShell must thread today/care load status into the screens");
}

for (const key of ['"today.loadFailed"', '"today.loading"', '"care.loadFailed"']) {
  if (occurrences(translations, key) < 2) {
    throw new Error(`${key} must be defined in both en and ko translations`);
  }
}

if (translations.includes("Pull to retry")) {
  throw new Error("reports.loadFailed must not advertise a pull-to-refresh gesture that does not exist");
}
