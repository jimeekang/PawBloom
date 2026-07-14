import type { ComponentProps } from "react";
import { ShortTermMedicationForm } from "./ShortTermMedicationForm";
import type { ActiveCareSetup } from "../domain/carePlan";

const emptySetup: ActiveCareSetup = { conditions: [], plans: [], schedules: [] };
const props: ComponentProps<typeof ShortTermMedicationForm> = {
  onSave: async () => emptySetup,
  onSaved: () => undefined,
};
const withoutOnSaved: ComponentProps<typeof ShortTermMedicationForm> = {
  onSave: async () => emptySetup,
};
void props;
void withoutOnSaved;
