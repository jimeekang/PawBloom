declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

const root = process.cwd();
const read = (path: string) => readFileSync(`${root}/apps/mobile/src/${path}`, "utf8");
const shell = read("presentation/PawBloomShell.tsx");
const petProfiles = read("presentation/screens/PetOnboardingScreen.tsx");
const diaryScreen = read("contexts/diary/ui/DiaryEntryScreen.tsx");
const diaryActions = read("contexts/diary/ui/DiaryEntryActions.tsx");
const careScreen = read("presentation/screens/CareModeScreen.tsx");
const medicationForm = read("contexts/medication/ui/CareMedicationPanel.tsx");

if (!shell.includes('can(activePet.role, "diary.update")') || !shell.includes('can(activePet.role, "report.confirm")')) {
  throw new Error("the active pet membership role must drive diary and report actions in the shell");
}
if (!petProfiles.includes("canManageActivePet") || !petProfiles.includes("permission.petOwnerOnly")) {
  throw new Error("non-owner pet profile controls must be replaced by an owner-only explanation");
}
if (!diaryScreen.includes("onEntryPress={canUpdate ? editEntry : undefined}") || !diaryActions.includes("editing && canDelete")) {
  throw new Error("diary edit and delete controls must follow their distinct role permissions");
}
if (!careScreen.includes("canManageCare") || !careScreen.includes("canDeleteDose")) {
  throw new Error("care-plan and medication-delete controls must use separate permissions");
}
if (!medicationForm.includes("canDelete ?") || !medicationForm.includes("permission.medicationDeleteOwnerOnly")) {
  throw new Error("non-owner medication editors must not receive a delete control");
}
