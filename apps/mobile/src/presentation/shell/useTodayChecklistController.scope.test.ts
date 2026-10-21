import { createHookHarness } from "../testHookHarness";
declare const require: (name: string) => any;
const modules = require("node:module"), original = modules._load, react = require("react"), harness = createHookHarness();
let confirmation: ((value: boolean) => void) | null = null;
modules._load = function(name: string, parent: unknown, main: boolean) {
  if (name === "react") return { ...react, ...harness.hooks };
  if (name.endsWith("/confirmAction")) return { confirmPrimaryAction: () => new Promise<boolean>((resolve) => { confirmation = resolve; }) };
  return original.call(this, name, parent, main);
};
try {
  const { useTodayChecklistController } = require("./useTodayChecklistController");
  let petId = "a", userId = "u", notices = 0, feedback = 0;
  let doses: any[] = [];
  const requests: Array<{ petId: string; resolve: (value: any) => void }> = [], updates: any[] = [];
  const render = () => harness.render(() => {
    const pet = petId;
    return useTodayChecklistController({ scopeKey: `${userId}:${pet}`, databaseMode: true, activePetId: pet, canDeleteDiary: true, canManageCare: true, canDeleteDose: true, localChecklist: {}, setLocalChecklist: () => undefined, activeEntries: [], activeDoses: doses, localEntries: [], localDoses: [], replaceLocalEntries: () => undefined, replaceLocalDoses: () => undefined,
      medicationAgenda: [{ source: "schedule", scheduleId: `schedule-${pet}`, doseId: doses[0]?.id, doseDate: "2026-10-20", medicationName: "Med", scheduledTime: "08:00", status: doses[0]?.status ?? "pending" }],
      createDiaryEntryRemote: async () => undefined, createMedicationDoseRemote: () => new Promise((resolve) => requests.push({ petId: pet, resolve })), deleteDiaryEntryRemote: async () => undefined, deleteMedicationDoseRemote: async () => undefined, updateMedicationDoseStatusRemote: async (input: any) => { updates.push(input); }, saveMedicationAgendaStatus: () => undefined, setNotice: () => { notices++; }, showSaveFeedback: () => { feedback++; } });
  });
  let result = render(); result.toggleChecklist("medication"); petId = "b"; render(); (confirmation as unknown as (value: boolean) => void)(true); await flush(); assert(requests.length === 0, "A confirmation completed after B navigation cannot start write");
  petId = "a"; result = render(); result.toggleChecklist("medication"); (confirmation as unknown as (value: boolean) => void)(true); await flush();
  petId = "b"; result = render(); result.toggleChecklist("medication"); (confirmation as unknown as (value: boolean) => void)(true); await flush(); assert(requests.length === 2, "each explicit pet starts its own pending operation");
  requests[0]!.resolve({ dose: { id: "saved-a", petId: "a", status: "completed" }, queued: false }); await flush();
  result = render(); result.toggleChecklist("medication"); await flush(); assert(requests.length === 2 && notices === 0 && feedback === 0, "late A result cannot clear B pending or produce UI feedback");
  requests[1]!.resolve({ dose: { id: "saved-b", petId: "b", status: "completed", scheduleId: "schedule-b", doseDate: "2026-10-20", medicationName: "Med", scheduledAt: "08:00" }, queued: false }); await flush();
  doses = [{ id: "saved-b", petId: "b", status: "completed", scheduleId: "schedule-b", doseDate: "2026-10-20", medicationName: "Med", scheduledAt: "08:00" }];
  result = render(); result.toggleChecklist("medication"); await flush(); assert(updates.length === 1 && updates[0].id === "saved-b", "undo belongs to B and cannot be replaced by late A");
  harness.unmount();
} finally { modules._load = original; }
async function flush() { for (let i = 0; i < 15; i++) await Promise.resolve(); }
function assert(value: unknown, message: string): void { if (!value) throw new Error(message); }
