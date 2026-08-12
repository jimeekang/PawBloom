declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as { readFileSync(path: string, encoding: "utf8"): string };
const root = process.cwd();
const screen = readFileSync(`${root}/apps/mobile/src/contexts/diary/ui/DiaryEntryScreen.tsx`, "utf8");
const shell = readFileSync(`${root}/apps/mobile/src/presentation/PawBloomShell.tsx`, "utf8");

for (const contract of [
  "activePetRef.current === petId",
  "setEditingEntry(null)",
  "setLastAppliedInitialEditingEntryId(null)",
  "pendingSaveMutation.current = null",
  "initialEditingEntry.petId !== petId",
]) {
  if (!screen.includes(contract)) throw new Error(`pet-scoped Diary draft reset is missing: ${contract}`);
}

if (!shell.includes("<DiaryEntryScreen petId={activePet.id}")) {
  throw new Error("PawBloomShell must key the mounted Diary draft to the active pet");
}

if (!screen.includes('text={t(notice.key)}') || screen.includes("notice.text")) {
  throw new Error("Diary notices must store translation keys so an in-app language change retranslates them");
}
