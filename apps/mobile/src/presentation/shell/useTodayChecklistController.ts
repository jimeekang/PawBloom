import { useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import type { DiaryEntry } from "../../contexts/diary/domain/diaryEntry";
import type { DoseRecord, DoseStatus } from "../../contexts/medication/domain/medication";
import { findPendingMedicationAgendaRow, type TodayMedicationAgendaRow } from "../../contexts/medication/ui/todayMedicationAgenda";
import { confirmPrimaryAction } from "../../design-system/confirmAction";
import { t, type TranslationKey } from "../../i18n/translations";
import { getLocalDateKey } from "../../shared-kernel/date";
import { createLocalChecklistRecord, isChecklistRecordBlocked, recordRemoteChecklistItem } from "./checklistActions";
import { getChecklistSuccessHomeNotice } from "./checklistNotice";
import { createChecklistFromRecords, type ChecklistKey } from "./todayChecklist";
import type { SaveFeedbackKind } from "./saveFeedback";

type Params = {
  databaseMode: boolean;
  activePetId: string;
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
  createMedicationDoseRemote: (input: { medicationName: string; status: "completed" }) => Promise<unknown>;
  updateMedicationDoseStatusRemote: (input: { id: string; status: "completed" }) => Promise<unknown>;
  setNotice: (notice: string, tone?: "success" | "error") => void;
  showSaveFeedback: (kind: SaveFeedbackKind) => void;
};

export function useTodayChecklistController({ databaseMode, activePetId, localChecklist, setLocalChecklist, activeEntries, activeDoses, localEntries, localDoses, replaceLocalEntries, replaceLocalDoses, medicationAgenda, saveMedicationAgendaStatus, createDiaryEntryRemote, createMedicationDoseRemote, updateMedicationDoseStatusRemote, setNotice, showSaveFeedback }: Params) {
  const pendingChecklistKeys = useRef<ChecklistKey[]>([]);
  const checklist = useMemo(() => (databaseMode ? createChecklistFromRecords(activeEntries, activeDoses) : localChecklist), [activeDoses, activeEntries, databaseMode, localChecklist]);

  function toggleChecklist(key: ChecklistKey) {
    const today = getLocalDateKey();
    const pendingMedicationAgendaRow = key === "medication" ? findPendingMedicationAgendaRow(medicationAgenda) : undefined;
    if (isChecklistRecordBlocked({ key, checklist, entries: activeEntries, entryDate: today, pendingKeys: pendingChecklistKeys.current, hasPendingMedicationAgenda: Boolean(pendingMedicationAgendaRow) })) {
      setNotice(t("ko", "today.checklistAlreadyRecorded"));
      return;
    }
    pendingChecklistKeys.current = [...pendingChecklistKeys.current, key];
    const clearPendingKey = () => {
      pendingChecklistKeys.current = pendingChecklistKeys.current.filter((item) => item !== key);
    };
    void confirmChecklistRecord(key).then((confirmed) => {
      if (!confirmed) {
        clearPendingKey();
        return;
      }
      if (pendingMedicationAgendaRow) {
        const saveResult = saveMedicationAgendaStatus(pendingMedicationAgendaRow, "completed");
        if (saveResult) void Promise.resolve(saveResult).finally(clearPendingKey);
        else setTimeout(clearPendingKey, 0);
        return;
      }
      if (!databaseMode) {
        recordLocalChecklistItem(key, today);
        setTimeout(clearPendingKey, 0);
        return;
      }
      void recordChecklistItem(key)
        .catch((error: Error) => setNotice(error.message, "error"))
        .finally(clearPendingKey);
    });
  }

  function confirmChecklistRecord(key: ChecklistKey) {
    const itemLabel = t("ko", `category.${key === "medication" ? "medication" : key}` as TranslationKey);
    return confirmPrimaryAction(
      {
        title: t("ko", "today.checklistConfirmTitle"),
        message: t("ko", "today.checklistConfirmCopy").replace("{item}", itemLabel),
        cancelText: t("ko", "today.checklistConfirmCancel"),
        confirmText: t("ko", "today.checklistConfirmConfirm"),
      },
      () => true,
    );
  }

  function recordLocalChecklistItem(key: ChecklistKey, entryDate: string) {
    const result = createLocalChecklistRecord({ key, entryDate, activePetId, entries: localEntries, doses: localDoses, activeDoses, checklist, quickMedicationName: t("ko", "care.quickMedicationName") });
    if (!result) return;
    if (result.nextEntries) replaceLocalEntries(result.nextEntries);
    if (result.nextDoses) replaceLocalDoses(result.nextDoses);
    setLocalChecklist(result.nextChecklist);
    setNotice(getChecklistSuccessHomeNotice());
    showSaveFeedback(result.feedbackKind);
  }

  async function recordChecklistItem(key: ChecklistKey) {
    const feedbackKind = await recordRemoteChecklistItem({ key, activeDoses, quickMedicationName: t("ko", "care.quickMedicationName"), createDiaryEntry: createDiaryEntryRemote, createMedicationDose: createMedicationDoseRemote, updateMedicationDoseStatus: updateMedicationDoseStatusRemote });
    setNotice(getChecklistSuccessHomeNotice());
    showSaveFeedback(feedbackKind);
  }

  return { checklist, toggleChecklist };
}
