declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

// Regression: preview Settings showed two pets while Home could not switch them.
const shellSource = readFileSync(
  `${process.cwd()}/apps/mobile/src/presentation/PawBloomShell.tsx`,
  "utf8",
);
const selectionSource = readFileSync(
  `${process.cwd()}/apps/mobile/src/presentation/shell/useShellPetSelection.ts`,
  "utf8",
);
const source = `${shellSource}\n${selectionSource}`;

for (const required of [
  "previewPetIndex",
  "setPreviewPetIndex",
  "isPreviewPet",
  "previewPets.length > 1",
  "ownedPetCount",
  "countOwnedPets",
]) {
  if (!source.includes(required)) {
    throw new Error(`preview pet switching contract is missing: ${required}`);
  }
}
