import type { QuickMedicationDoseInput } from "./medicationDoseRecords";
import { decodeMedicationDoseCareNote, encodeMedicationDoseCareNote } from "./medicationDoseRecords";

const quickDose: QuickMedicationDoseInput = {
  conditionName: "Pancreatitis",
  medicationName: "Cerenia",
  dosageLabel: "16 mg tablet",
  administeredAmount: "1/2 tablet",
  reactionNote: "Ate a small meal after dose.",
  status: "completed",
};

const encoded = encodeMedicationDoseCareNote(quickDose);
const decoded = decodeMedicationDoseCareNote(encoded);

const conditionName: string | undefined = decoded.conditionName;
const dosageLabel: string | undefined = decoded.dosageLabel;
const administeredAmount: string | undefined = decoded.administeredAmount;
const reactionNote: string | undefined = decoded.reactionNote;

void conditionName;
void dosageLabel;
void administeredAmount;
void reactionNote;
