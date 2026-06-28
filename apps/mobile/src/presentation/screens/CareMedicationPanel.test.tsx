import type { ComponentProps } from "react";
import { QuickMedicationForm, type QuickMedicationSaveHandler } from "./CareMedicationPanel";

const asyncSave: QuickMedicationSaveHandler = async (input) => {
  const medicationName: string = input.medicationName;
  void medicationName;
};

const syncSave: QuickMedicationSaveHandler = (input) => {
  const medicationName: string = input.medicationName;
  void medicationName;
};

const asyncProps: ComponentProps<typeof QuickMedicationForm> = { onSave: asyncSave };
const syncProps: ComponentProps<typeof QuickMedicationForm> = { onSave: syncSave };

void asyncProps;
void syncProps;
