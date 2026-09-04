import type { ComponentProps } from "react";
import { CareMedicationAddCard } from "./CareMedicationAddCard";
import type { ActiveCareSetup } from "../../contexts/care/domain/carePlan";

declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const emptySetup: ActiveCareSetup = { conditions: [], plans: [], schedules: [] };
const props: ComponentProps<typeof CareMedicationAddCard> = {
  petId: "pet-1",
  onAddDose: async () => undefined,
  onSaveCareSetup: async () => emptySetup,
  onOpenProfileCare: () => undefined,
  onSaved: () => undefined,
};

const { readFileSync } = require("node:fs") as { readFileSync(path: string, encoding: "utf8"): string };
const addCardSource = readFileSync(`${process.cwd()}/apps/mobile/src/presentation/screens/CareMedicationAddCard.tsx`, "utf8");
const quickFormSource = readFileSync(`${process.cwd()}/apps/mobile/src/contexts/medication/ui/CareMedicationPanel.tsx`, "utf8");

if (!addCardSource.includes('<QuickMedicationForm onSave={onAddDose} onSaved={onSaved} />')) {
  throw new Error("a successful today-only medication save must close the temporary add card");
}

if (!quickFormSource.includes("onSaved?.()")) {
  throw new Error("the quick medication form must notify its owner after a successful create");
}

void props;
