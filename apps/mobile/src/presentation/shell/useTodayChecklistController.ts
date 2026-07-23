import { useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import type { DiaryEntry } from "../../contexts/diary/domain/diaryEntry";
import type { DoseRecord, DoseStatus } from "../../contexts/medication/domain/medication";
import { findPendingMedicationAgendaRow, type TodayMedicationAgendaRow } from "../../contexts/medication/ui/todayMedicationAgenda";
import { t } from "../../i18n/translations";
import { getLocalDateKey } from "../../shared-kernel/date";
import { createLocalChecklistRecord, isChecklistRecordBlocked, recordRemoteChecklistItem } from "./checklistActions";
import { applyLocalMedicationUndo, createRestoreMedicationUndoFromAgenda, resolveDiaryChecklistUndo, resolveMedicationUndoDose, type MedicationChecklistUndo } from "./checklistUndo";
import { getChecklistSuccessHomeNotice } from "./checklistNotice";
import { createChecklistFromRecords, type ChecklistKey } from "./todayChecklist";
import type { SaveFeedbackKind } from "./saveFeedback";

type Params = {
  databaseMode: boolean;
  activePetId: string;
  canDeleteDiary: boolean;
  canManageCare: boolean;
  canDeleteDose: boolean;
  localChecklist: Record<ChecklistKey, boolean>;
  setLocalChecklist: Dispatch<SetStateAction<Record<ChecklistKey, boolean>>>;
  activeEntries: DiaryEntry[];
  activeDoses: DoseRecord[];
  localEntries: DiaryEntry[];
  localDoses: DoseRecord[];
  replaceLocalEntries: (nextEntries: DiaryEntry[]) => void;
  replaceLocalDoses: (nextDoses: DoseRecord[]) => void;
  medicationAgenda: TodayMedicationAgendaRow[];
  saveMedicationAgendaStatus: (row: TodayMedicationAgendaRow, status: Extract<DoseStatus, "completed" | "skipped" | "partial">) => Promise<void> | void;
  createDiaryEntryRemote: (input: { category: DiaryEntry["category"]; summary: string; origin?: "diary" | "checklist"; conditionScore?: 1 | 2 | 3 | 4 | 5 }) => Promise<unknown>;
  createMedicationDoseRemote: (input: { scheduleId?: string; doseDate?: string; scheduledTime?: string; conditionName?: string; medicationName: string; dosageLabel?: string; status: "completed" }) => Promise<{ dose?: DoseRecord; queued?: boolean }>;
  deleteDiaryEntryRemote: (id: string) => Promise<unknown>;
  deleteMedicationDoseRemote: (id: string) => Promise<unknown>;
  updateMedicationDoseStatusRemote: (input: { id: string; status: DoseStatus }) => Promise<unknown>;
  setNotice: (notice: string) => void;
  showSaveFeedback: (kind: SaveFeedbackKind) => void;
};

export function useTodayChecklistController({ databaseMode, activePetId, canDeleteDiary, canManageCare, canDeleteDose, localChecklist, setLocalChecklist, activeEntries, activeDoses, localEntries, localDoses, replaceLocalEntries, replaceLocalDoses, medicationAgenda, saveMedicationAgendaStatus, createDiaryEntryRemote, createMedicationDoseRemote, deleteDiaryEntryRemote, deleteMedicationDoseRemote, updateMedicationDoseStatusRemote, setNotice, showSaveFeedback }: Params) {
  const pendingChecklistKeys = useRef<ChecklistKey[]>([]);
  const medicationUndoRef = useRef<MedicationChecklistUndo | null>(null);
  const checklist = useMemo(() => (databaseMode ? createChecklistFromRecords(activeEntries, activeDoses) : localChecklist), [activeDoses, activeEntries, databaseMode, localChecklist]);
  useEffect(() => {
    pendingChecklistKeys.current = [];
    medicationUndoRef.current = null;
  }, [activePetId, databaseMode]);

  function toggleChecklist(key: ChecklistKey) {
    const today = getLocalDateKey();
    if (pendingChecklistKeys.current.includes(key)) return;
    if (checklist[key]) {
      pendingChecklistKeys.current = [...pendingChecklistKeys.current, key];
      void undoChecklistItem(key, today)
        .catch((error: Error) => setNotice(error.message))
        .finally(() => clearPendingKey(key));
      return;
    }
    if (isChecklistRecordBlocked({ key, checklist, entries: activeEntries, entryDate: today, pendingKeys: pendingChecklistKeys.current })) {
      setNotice(t("ko", "today.checklistAlreadyRecorded"));
      return;
    }
    pendingChecklistKeys.current = [...pendingChecklistKeys.current, key];
    const pendingMedicationAgendaRow = key === "medication" ? findPendingMedicationAgendaRow(medicationAgenda) : undefined;
    if (pendingMedicationAgendaRow) {
      if (!databaseMode) {
        const currentDose = pendingMedicationAgendaRow.doseId ? activeDoses.find((dose) => dose.id === pendingMedicationAgendaRow.doseId) : undefined;
        medicationUndoRef.current = createRestoreMedicationUndoFromAgenda(pendingMedicationAgendaRow, activePetId, currentDose);
        const saveResult = saveMedicationAgendaStatus(pendingMedicationAgendaRow, "completed");
        if (saveResult) saveResult.finally(() => clearPendingKey(key));
        else setTimeout(() => clearPendingKey(key), 0);
        return;
      }
      void recordRemoteMedicationAgendaItem(pendingMedicationAgendaRow)
        .catch((error: Error) => setNotice(error.message))
        .finally(() => clearPendingKey(key));
      return;
    }
    if (!databaseMode) {
      recordLocalChecklistItem(key, today);
      setTimeout(() => clearPendingKey(key), 0);
      return;
    }
    void recordChecklistItem(key)
      .catch((error: Error) => setNotice(error.message))
      .finally(() => clearPendingKey(key));
  }

  function recordLocalChecklistItem(key: ChecklistKey, entryDate: string) {
    const result = createLocalChecklistRecord({ key, entryDate, activePetId, entries: localEntries, doses: localDoses, activeDoses, checklist, quickMedicationName: t("ko", "care.quickMedicationName") });
    if (!result) return;
    if (result.nextEntries) replaceLocalEntries(result.nextEntries);
    if (result.nextDoses) replaceLocalDoses(result.nextDoses);
    if ("medicationUndo" in result) medicationUndoRef.current = result.medicationUndo ?? null;
    setLocalChecklist(result.nextChecklist);
    setNotice(getChecklistSuccessHomeNotice());
    showSaveFeedback(result.feedbackKind);
  }

  async function recordChecklistItem(key: ChecklistKey) {
    const result = await recordRemoteChecklistItem({ key, activeDoses, quickMedicationName: t("ko", "care.quickMedicationName"), createDiaryEntry: createDiaryEntryRemote, createMedicationDose: createMedicationDoseRemote, updateMedicationDoseStatus: updateMedicationDoseStatusRemote });
    if (key === "medication") medicationUndoRef.current = result.medicationUndo ?? null;
    setNotice(getChecklistSuccessHomeNotice());
    showSaveFeedback(result.feedbackKind);
  }

  async function recordRemoteMedicationAgendaItem(row: TodayMedicationAgendaRow) {
    const currentDose = row.doseId ? activeDoses.find((dose) => dose.id === row.doseId) : undefined;
    if (row.doseId) {
      await updateMedicationDoseStatusRemote({ id: row.doseId, status: "completed" });
      medicationUndoRef.current = createRestoreMedicationUndoFromAgenda(row, activePetId, currentDose);
    } else {
      const result = await createMedicationDoseRemote({ scheduleId: row.scheduleId, doseDate: row.doseDate, scheduledTime: row.scheduledTime, medicationName: row.medicationName, conditionName: row.conditionName, dosageLabel: row.dosageLabel, status: "completed" });
      medicationUndoRef.current = !result.queued && result.dose ? createRestoreMedicationUndoFromAgenda(row, activePetId, result.dose) : null;
    }
    setNotice(getChecklistSuccessHomeNotice());
    showSaveFeedback("medicationStatus");
  }

  async function undoChecklistItem(key: ChecklistKey, entryDate: string) {
    if (key === "medication") {
      await undoMedicationChecklistItem(entryDate);
      return;
    }

    const resolution = resolveDiaryChecklistUndo(activeEntries, key, entryDate);
    if (resolution.status === "protected") {
      setNotice(t("ko", "today.checklistProtectedDiary"));
      return;
    }
    if (resolution.status === "unavailable") {
      setNotice(t("ko", "today.checklistUndoUnavailable"));
      return;
    }
    if (!canDeleteDiary) {
      setNotice(t("ko", "permission.diaryDeleteOwnerOnly"));
      return;
    }

    if (databaseMode) {
      await deleteDiaryEntryRemote(resolution.entry.id);
    } else {
      const nextEntries = localEntries.filter((entry) => entry.id !== resolution.entry.id);
      replaceLocalEntries(nextEntries);
      syncLocalChecklist(nextEntries, localDoses, entryDate);
    }
    setNotice(t("ko", "today.checklistUndone"));
  }

  async function undoMedicationChecklistItem(entryDate: string) {
    const undo = medicationUndoRef.current;
    if (!undo) {
      setNotice(t("ko", "today.checklistProtectedMedication"));
      return;
    }
    const dose = resolveMedicationUndoDose(activeDoses, undo);
    if (!dose) {
      medicationUndoRef.current = null;
      setNotice(t("ko", "today.checklistUndoUnavailable"));
      return;
    }
    if (undo.kind === "restore-status" && !canManageCare) {
      setNotice(t("ko", "permission.careTeamOnly"));
      return;
    }
    if (undo.kind === "delete-dose" && !canDeleteDose) {
      setNotice(t("ko", "permission.medicationDeleteOwnerOnly"));
      return;
    }

    if (databaseMode) {
      if (undo.kind === "restore-status") await updateMedicationDoseStatusRemote({ id: dose.id, status: "pending" });
      else await deleteMedicationDoseRemote(dose.id);
    } else {
      const nextDoses = applyLocalMedicationUndo(localDoses, undo);
      if (!nextDoses) {
        medicationUndoRef.current = null;
        setNotice(t("ko", "today.checklistUndoUnavailable"));
        return;
      }
      replaceLocalDoses(nextDoses);
      syncLocalChecklist(localEntries, nextDoses, entryDate);
    }
    medicationUndoRef.current = null;
    setNotice(t("ko", "today.checklistUndone"));
  }

  function syncLocalChecklist(nextEntries: DiaryEntry[], nextDoses: DoseRecord[], entryDate: string) {
    setLocalChecklist(createChecklistFromRecords(
      nextEntries.filter((entry) => entry.petId === activePetId && entry.entryDate === entryDate),
      nextDoses.filter((dose) => dose.petId === activePetId),
    ));
  }

  function clearPendingKey(key: ChecklistKey) {
    pendingChecklistKeys.current = pendingChecklistKeys.current.filter((item) => item !== key);
  }

  return { checklist, toggleChecklist };
}
