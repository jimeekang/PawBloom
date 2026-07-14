import type { ComponentProps } from "react";
import { CareMedicationAddCard } from "./CareMedicationAddCard";
import type { ActiveCareSetup } from "../../contexts/care/domain/carePlan";

const emptySetup: ActiveCareSetup = { conditions: [], plans: [], schedules: [] };
const props: ComponentProps<typeof CareMedicationAddCard> = {
  petId: "pet-1",
  onAddDose: async () => undefined,
  onSaveCareSetup: async () => emptySetup,
  onOpenProfileCare: () => undefined,
  onSaved: () => undefined,
};
void props;
