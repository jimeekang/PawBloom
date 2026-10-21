declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };
const { readFileSync } = require("node:fs") as { readFileSync(path: string, encoding: "utf8"): string };
const source = readFileSync(`${process.cwd()}/apps/mobile/src/presentation/shell/ShellHeaders.tsx`, "utf8");
if (source.includes('name="bell"') || source.includes("onManagePets")) throw new Error("headers must not advertise inert actions");
for (const required of ["HouseHeaderProps", "PetDetailHeaderProps", "PetSettingsHeaderProps", "ShellTitleHeaderProps", "onPress={onAddPet}", "onPress={onRequestRecord}"]) {
  if (!source.includes(required)) throw new Error(`missing typed header contract: ${required}`);
}
if (!source.includes("{petName}") || !source.includes("accessibilityLabel={label}") || !source.includes('t("navigation.back")')) throw new Error("pet detail must expose its selected name and a localized back control");
const house = readFileSync(`${process.cwd()}/apps/mobile/src/presentation/screens/HouseScreen.tsx`, "utf8");
if (!house.includes('t("house.openPet").replace("{petName}", pet.name)') || !house.includes('t("house.confirmRecord").replace("{petName}", pet.name)')) throw new Error("accessible buttons must explicitly name both pet selection and record target");
