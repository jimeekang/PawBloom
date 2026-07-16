import type { DiaryEntry } from "../../contexts/diary/domain/diaryEntry";
import type { DoseRecord } from "../../contexts/medication/domain/medication";
import type { TodayMedicationAgendaRow } from "../../contexts/medication/ui/todayMedicationAgenda";
import type { ChecklistKey } from "./todayChecklist";

export type MedicationChecklistUndo = {
  kind: "restore-status" | "delete-dose";
  doseId?: string;
  scheduleId?: string;
  doseDate?: string;
  expectedFingerprint: string;
};

export type DiaryChecklistUndoResolution =
  | { status: "ready"; entry: DiaryEntry }
  | { status: "protected" }
  | { status: "unavailable" };

export function resolveDiaryChecklistUndo(entries: DiaryEntry[], key: ChecklistKey, entryDate: string): DiaryChecklistUndoResolution {
  const category = key === "medication" ? null : key;
  if (!category) return { status: "unavailable" };
  const matchingEntries = entries.filter((item) => item.category === category && item.entryDate === entryDate);
  if (matchingEntries.length === 0) return { status: "unavailable" };
  if (matchingEntries.some((entry) => entry.origin !== "checklist")) return { status: "protected" };
  if (matchingEntries.length !== 1) return { status: "unavailable" };
  return { status: "ready", entry: matchingEntries[0] };
}

export function createRestoreMedicationUndoFromAgenda(row: TodayMedicationAgendaRow, activePetId: string, currentDose?: DoseRecord): MedicationChecklistUndo {
  const expectedDose = currentDose
    ? { ...currentDose, status: "completed" as const }
    : {
        petId: activePetId,
        scheduleId: row.scheduleId,
        doseDate: row.doseDate,
        medicationName: row.medicationName,
        conditionName: row.conditionName,
        dosageLabel: row.dosageLabel,
        scheduledAt: row.scheduledTime,
        status: "completed" as const,
      };
  return {
    kind: "restore-status",
    doseId: row.doseId,
    scheduleId: row.scheduleId,
    doseDate: row.doseDate,
    expectedFingerprint: medicationUndoFingerprint(expectedDose),
  };
}

export function createRestoreMedicationUndo(dose: DoseRecord): MedicationChecklistUndo {
  return {
    kind: "restore-status",
    doseId: dose.id,
    scheduleId: dose.scheduleId,
    doseDate: dose.doseDate,
    expectedFingerprint: medicationUndoFingerprint(dose),
  };
}

export function createDeleteMedicationUndo(dose: DoseRecord): MedicationChecklistUndo {
  return {
    kind: "delete-dose",
    doseId: dose.id,
    scheduleId: dose.scheduleId,
    doseDate: dose.doseDate,
    expectedFingerprint: medicationUndoFingerprint(dose),
  };
}

export function resolveMedicationUndoDose(doses: DoseRecord[], undo: MedicationChecklistUndo): DoseRecord | null {
  const dose = undo.doseId
    ? doses.find((item) => item.id === undo.doseId)
    : doses.find((item) => item.scheduleId === undo.scheduleId && item.doseDate === undo.doseDate);
  if (!dose || medicationUndoFingerprint(dose) !== undo.expectedFingerprint) return null;
  return dose;
}

export function applyLocalMedicationUndo(doses: DoseRecord[], undo: MedicationChecklistUndo): DoseRecord[] | null {
  const dose = resolveMedicationUndoDose(doses, undo);
  if (!dose) return null;
  if (undo.kind === "delete-dose") return doses.filter((item) => item.id !== dose.id);
  return doses.map((item) => (item.id === dose.id ? { ...item, status: "pending", recordedAt: undefined } : item));
}

function medicationUndoFingerprint(dose: Pick<DoseRecord, "petId" | "scheduleId" | "doseDate" | "medicationName" | "conditionName" | "dosageLabel" | "administeredAmount" | "scheduledAt" | "status" | "reactionNote">) {
  return JSON.stringify([
    dose.petId,
    dose.scheduleId ?? "",
    dose.doseDate ?? "",
    dose.medicationName,
    dose.conditionName ?? "",
    dose.dosageLabel ?? "",
    dose.administeredAmount ?? "",
    dose.scheduledAt,
    dose.status,
    dose.reactionNote ?? "",
  ]);
}
