declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

// Regression: UX-004 — Care duplicated the real Reports workflow with a static segment
// Found by /qa on 2026-07-16
// Report: .gstack/qa-reports/qa-report-pawbloom-ui-ux-2026-07-16.md

const source = readFileSync(
  `${process.cwd()}/apps/mobile/src/presentation/screens/CareModeScreen.tsx`,
  "utf8",
);

if (source.includes("CareReportPanel") || source.includes('"care.segment.reports"')) {
  throw new Error("Care must not keep a second, static report workflow");
}

if (!source.includes('label={t("ko", "care.generateVetReport")}') || !source.includes("onPress={onGenerateReport}")) {
  throw new Error("Care must keep one explicit handoff to the real Reports tab");
}
