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

for (const required of ["selectPetId", "accessiblePets", "isPreviewPet", "ownedPetCount", "countOwnedPets", 'key={user?.id ?? "preview"}']) {
  if (!source.includes(required)) throw new Error(`explicit account-scoped preview selection contract is missing: ${required}`);
}
if (selectionSource.includes("selectNextPet") || shellSource.includes("cyclePet")) throw new Error("direct pet routes must not depend on cycling");
if (!shellSource.includes("activePet.id === route.petId") || !shellSource.includes("resolveAccessibleRoute(routeState, accessibleIds,")) throw new Error("detail writes require current explicit pet and accessible route");
