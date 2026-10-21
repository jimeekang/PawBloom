import { createHookHarness } from "../testHookHarness";
import { createChecklistFromRecords } from "./todayChecklist";
declare const require: (name: string) => any;
const modules = require("node:module"), original = modules._load, react = require("react"), harness = createHookHarness();
const noop = () => undefined;
modules._load = function(name: string, parent: unknown, main: boolean) {
  if (name === "react") return { ...react, ...harness.hooks };
  if (name.endsWith("/carePlanRecords")) return { useActiveCareSetup: () => ({}), useCreateCareSetup: () => ({}) };
  if (name.endsWith("/medicationDoseRecords")) return Object.fromEntries(["useTodayMedicationDoses", "useCreateMedicationDose", "useUpdateMedicationDose", "useDeleteMedicationDose", "useUpdateMedicationDoseStatus"].map((key) => [key, () => ({})]));
  return original.call(this, name, parent, main);
};
try {
  const { useCareSetupState } = require("../../contexts/care/ui/useCareSetupState");
  const { useMedicationDosesController } = require("../../contexts/medication/ui/useMedicationDosesController");
  const entries: never[] = [], references: any[] = [];
  let commits = 0;
  const render = () => harness.render(() => {
    commits++;
    const care = useCareSetupState({ activePetId: "a", databaseMode: false, livePetId: null, userId: null, onNotice: noop, onSaved: noop });
    const medication = useMedicationDosesController({ activePetId: "a", databaseMode: false, livePetId: null, userId: null, fallbackPetId: "a", language: "en", schedules: care.activeCareSetup.schedules, onNotice: noop, onSaved: noop, onLocalDoseSaved: noop, onLocalDosesChanged: noop });
    const [checklist, setChecklist] = harness.hooks.useState({});
    references.push({ schedules: care.activeCareSetup.schedules, activeDoses: medication.activeDoses, agenda: medication.medicationAgenda });
    harness.hooks.useEffect(() => setChecklist(createChecklistFromRecords(entries, medication.activeDoses, medication.medicationAgenda)), [entries, medication.activeDoses, medication.medicationAgenda]);
    return checklist;
  });
  let checklist;
  try { checklist = render(); } catch (error) {
    const last = references.at(-1), prior = references.at(-2);
    throw new Error(`${(error as Error).message}; commits=${commits}; stable schedules=${last.schedules === prior.schedules}, activeDoses=${last.activeDoses === prior.activeDoses}, agenda=${last.agenda === prior.agenda}`);
  }
  const settledCommits = commits;
  if (render() !== checklist || commits !== settledCommits + 1) throw new Error("unchanged checklist must retain identity without extra commits");
  console.log(`Real care + medication + shell checklist effect settled in ${settledCommits} commits`);
} finally { modules._load = original; }
