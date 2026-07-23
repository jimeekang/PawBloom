declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync, readdirSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
  readdirSync(path: string, options: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
};

// Regression: UX-007D — non-auth forms still relied on placeholder inference for accessible names
// Found by /qa on 2026-07-16
// Report: .gstack/qa-reports/qa-report-pawbloom-ui-ux-2026-07-16.md

const sourceRoot = `${process.cwd()}/apps/mobile/src`;
const failures: string[] = [];

function visit(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      visit(path);
      continue;
    }
    if (!entry.name.endsWith(".tsx")) continue;
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(/<TextInput\b[\s\S]*?>/g)) {
      if (!match[0].includes("accessibilityLabel=")) {
        failures.push(path.replace(`${process.cwd()}/`, ""));
        break;
      }
    }
  }
}

visit(sourceRoot);

if (failures.length > 0) {
  throw new Error(`Every TextInput must have an explicit accessible name: ${failures.join(", ")}`);
}

const commonControls = readFileSync(`${sourceRoot}/design-system/components.tsx`, "utf8");
if ((commonControls.match(/accessibilityLabel=\{label\}/g) ?? []).length < 2) {
  throw new Error("primary and secondary buttons must expose their visible label explicitly");
}
