declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

// Regression: UX-002 — the six-week month calendar blocked the primary diary form
// Found by /qa on 2026-07-16
// Report: .gstack/qa-reports/qa-report-pawbloom-ui-ux-2026-07-16.md

const source = readFileSync(
  `${process.cwd()}/apps/mobile/src/contexts/diary/ui/DiaryCalendar.tsx`,
  "utf8",
);

if (!source.includes("useState(false)")) {
  throw new Error("the Diary calendar must start collapsed");
}

if (!source.includes("accessibilityState={{ expanded }}") || !source.includes("aria-expanded={expanded}")) {
  throw new Error("the calendar disclosure must expose its expanded state");
}

if (!source.includes("setExpanded(false)")) {
  throw new Error("selecting a date must collapse the calendar and return focus to the diary task");
}
