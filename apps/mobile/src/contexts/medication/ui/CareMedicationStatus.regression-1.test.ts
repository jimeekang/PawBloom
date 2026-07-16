declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

import { careStatusActionLabel } from "./careMedicationPanelState";

const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

// Regression: UX-003 — partial doses could not be recorded from the medication agenda
// Found by /qa on 2026-07-16
// Report: .gstack/qa-reports/qa-report-pawbloom-ui-ux-2026-07-16.md

if (careStatusActionLabel("partial") !== "일부만") {
  throw new Error("the medication agenda must expose caregiver-friendly partial-dose wording");
}

const source = readFileSync(
  `${process.cwd()}/apps/mobile/src/presentation/screens/CareModeScreen.tsx`,
  "utf8",
);

if (!source.includes('onStatusChange("partial")')) {
  throw new Error("the medication agenda must send the partial status directly");
}

if (!source.includes('accessibilityState={{ selected: row.status === "partial" }}')) {
  throw new Error("the partial-dose action must expose its selected state");
}
