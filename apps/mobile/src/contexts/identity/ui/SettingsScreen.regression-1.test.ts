declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

// Regression: UX-005 — preview settings exposed sign-out and Supabase/.env developer copy
// Found by /qa on 2026-07-16
// Report: .gstack/qa-reports/qa-report-pawbloom-ui-ux-2026-07-16.md

const source = readFileSync(
  `${process.cwd()}/apps/mobile/src/contexts/identity/ui/SettingsScreen.tsx`,
  "utf8",
);

if (!source.includes("configured\n            ? <SecondaryButton")) {
  throw new Error("sign-out must be rendered only for a configured account");
}

if (source.includes("settings.supabase") || source.includes("settings.environment")) {
  throw new Error("user settings must not expose backend vendor or environment setup details");
}

if (!source.includes('"settings.localOnly"') || !source.includes('"settings.syncReady"')) {
  throw new Error("settings must explain user-facing local and synced data states");
}
