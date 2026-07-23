declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

// Regression: 0006 B5/B9 — reminder side effects must not fire where they
// cannot work: preview/web saves skip the reminder notice entirely (no false
// "permission needed" error), and saving with meal reminders disabled must
// not pop the OS permission dialog.

function read(path: string) {
  return readFileSync(`${process.cwd()}/apps/mobile/src/${path}`, "utf8");
}

function occurrences(source: string, needle: string) {
  return source.split(needle).length - 1;
}

const shell = read("presentation/PawBloomShell.tsx");
const mealReminders = read("contexts/routine/application/mealReminderNotifications.ts");

if (occurrences(shell, 'if (!databaseMode || !userId || Platform.OS === "web")') < 2) {
  throw new Error("both care and routine save paths must skip reminder notices in preview/web mode (B5)");
}

const planIndex = mealReminders.indexOf("const plan = buildMealReminderPlan");
const permissionIndex = mealReminders.indexOf("requestPermissionsAsync");
if (planIndex === -1 || permissionIndex === -1 || planIndex > permissionIndex) {
  throw new Error("rescheduleMealReminders must build the plan before requesting notification permission (B9)");
}

if (!mealReminders.includes("if (plan.length > 0)")) {
  throw new Error("an empty meal reminder plan (reminders disabled) must skip the OS permission request (B9)");
}

if (!shell.includes("petSettingsNotice")) {
  throw new Error(
    "the pet settings screen must render the shell notice banner — reminder toggle/save feedback (permission denied etc.) was invisible there (Phase B review finding)",
  );
}
