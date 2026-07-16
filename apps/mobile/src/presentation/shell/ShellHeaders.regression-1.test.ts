declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

// Regression: UX-006 — Home displayed an inert notification bell and unused action prop
// Found by /qa on 2026-07-16
// Report: .gstack/qa-reports/qa-report-pawbloom-ui-ux-2026-07-16.md

const source = readFileSync(
  `${process.cwd()}/apps/mobile/src/presentation/shell/ShellHeaders.tsx`,
  "utf8",
);

if (source.includes('name="bell"') || source.includes("onManagePets")) {
  throw new Error("Home must not advertise a notification or management action that cannot run");
}

if (!source.includes("accessibilityState={{ disabled: !canSwitchPet }}")) {
  throw new Error("the remaining pet switcher must keep its disabled state explicit");
}

if (!source.includes('accessibilityLabel={`${t("ko", "pet.selectTitle")}: ${petName}`}')) {
  throw new Error("the pet switcher must expose the selected pet in its accessible name");
}
