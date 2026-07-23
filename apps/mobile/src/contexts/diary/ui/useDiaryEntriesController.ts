import { useEffect, useMemo, useState } from "react";
import { getLocalDateKey, getWeekDateRange, useCreateDiaryEntry, useDeleteDiaryEntry, useDiaryEntriesByDate, useDiaryEntriesByDateRange, useTodayDiaryEntries, useUpdateDiaryEntry } from "../application/diaryRecords";
import type { DiaryEntry } from "../domain/diaryEntry";
import { t } from "../../../i18n/translations";
import { confirmDestructiveAction } from "../../../design-system/confirmAction";
import type { DiaryFilter } from "./DiaryCalendar";
import type { DraftDiaryEntry } from "./draftDiaryEntry";
import { buildSampleDiaryEntries, relocalizeSampleDiaryEntries } from "./sampleDiaryEntries";
import { createLocalDiaryEntry, getTodayEntriesForPet, updateLocalDiaryEntry } from "./localDiaryState";
import { resolveRemoteDiarySaveOutcome } from "./DiaryEntryScreen.logic";
import type { Language } from "../../../shared-kernel/types";

type Params = {
  activePetId: string;
  databaseMode: boolean;
  livePetId: string | null;
  userId: string | null;
  fallbackPetId: string;
  language: Language;
  onNotice: (notice: string, tone?: "success" | "error") => void;
  onSaved: () => void;
  onLocalEntrySaved: (entry: DiaryEntry) => void;
  onLocalEntriesChanged: (nextEntries: DiaryEntry[]) => void;
};

export function useDiaryEntriesController({ activePetId, databaseMode, livePetId, userId, fallbackPetId, language, onNotice, onSaved, onLocalEntrySaved, onLocalEntriesChanged }: Params) {
  const diaryQuery = useTodayDiaryEntries(livePetId, userId);
  const createDiaryEntry = useCreateDiaryEntry(livePetId, userId);
  const updateDiaryEntry = useUpdateDiaryEntry(livePetId, userId);
  const deleteDiaryEntry = useDeleteDiaryEntry(livePetId, userId);
  const [entries, setEntries] = useState<DiaryEntry[]>(() => buildSampleDiaryEntries(fallbackPetId, language));
  const [selectedDiaryDate, setSelectedDiaryDate] = useState(getLocalDateKey());
  const [diaryFilter, setDiaryFilter] = useState<DiaryFilter>("day");
  const [timelineEditEntry, setTimelineEditEntry] = useState<DiaryEntry | null>(null);
  const selectedWeekRange = useMemo(() => getWeekDateRange(selectedDiaryDate), [selectedDiaryDate]);
  const diaryDateQuery = useDiaryEntriesByDate(livePetId, selectedDiaryDate, userId);
  const diaryWeekQuery = useDiaryEntriesByDateRange(livePetId, selectedWeekRange.fromDateKey, selectedWeekRange.toDateKey, userId);

  useEffect(() => {
    if (!databaseMode) setEntries((current) => relocalizeSampleDiaryEntries(current, language));
  }, [databaseMode, language]);

  const activeEntries = useMemo(() => (databaseMode ? diaryQuery.data ?? [] : entries.filter((entry) => entry.petId === activePetId && entry.entryDate === getLocalDateKey())), [activePetId, databaseMode, diaryQuery.data, entries]);

  const selectedDiaryEntries = useMemo(() => {
    if (databaseMode) {
      return diaryFilter === "day" ? diaryDateQuery.data ?? [] : diaryWeekQuery.data ?? [];
    }
    return entries.filter((entry) => entry.petId === activePetId && (diaryFilter === "day" ? entry.entryDate === selectedDiaryDate : entry.entryDate >= selectedWeekRange.fromDateKey && entry.entryDate <= selectedWeekRange.toDateKey));
  }, [activePetId, databaseMode, diaryDateQuery.data, diaryFilter, diaryWeekQuery.data, entries, selectedDiaryDate, selectedWeekRange.fromDateKey, selectedWeekRange.toDateKey]);

  const latestConditionScore = activeEntries.find((entry) => entry.category === "condition" && entry.conditionScore)?.conditionScore;

  const selectedQuery = diaryFilter === "day" ? diaryDateQuery : diaryWeekQuery;
  const selectedDiaryStatus: "ready" | "loading" | "error" = !databaseMode ? "ready" : selectedQuery.isError ? "error" : selectedQuery.isLoading ? "loading" : "ready";
  function refetchSelectedDiary() {
    void (diaryFilter === "day" ? diaryDateQuery.refetch() : diaryWeekQuery.refetch());
  }

  function saveDiaryEntry(draft: DraftDiaryEntry) {
    if (databaseMode) {
      return createDiaryEntry
        .mutateAsync({ category: draft.category, summary: draft.summary, detail: draft.detail, entryDate: draft.entryDate, occurredTime: draft.occurredAt, origin: draft.origin, conditionScore: draft.conditionScore, photos: draft.photos, clientMutationId: draft.clientMutationId })
        .then((result) => {
          const outcome = resolveRemoteDiarySaveOutcome(result.queued);
          onNotice(outcome === "queued" ? t("ko", "today.diaryQueued") : "");
          onSaved();
          return outcome;
        })
        .catch((error: Error) => { onNotice(error.message, "error"); throw error; });
    }
    const nextEntry = createLocalDiaryEntry(activePetId, draft);
    setEntries((current) => [nextEntry, ...current]);
    onLocalEntrySaved(nextEntry);
    onNotice("");
    onSaved();
    return "saved" as const;
  }

  async function updateDiaryRecord(draft: DraftDiaryEntry & { id: string; occurredTime: string }) {
    if (databaseMode) {
      try {
        await updateDiaryEntry.mutateAsync({ id: draft.id, category: draft.category, summary: draft.summary, detail: draft.detail, entryDate: draft.entryDate, occurredTime: draft.occurredTime, origin: draft.origin, conditionScore: draft.conditionScore, photos: draft.photos, clientMutationId: draft.clientMutationId });
        onNotice(""); onSaved();
      } catch (error) {
        onNotice(error instanceof Error ? error.message : t("ko", "diary.updateFailed"), "error"); throw error;
      }
      return;
    }
    const nextEntries = entries.map((entry) => (entry.id === draft.id ? updateLocalDiaryEntry(entry, draft) : entry));
    setEntries(nextEntries);
    onLocalEntriesChanged(nextEntries);
    onNotice("");
    onSaved();
  }

  function deleteDiaryRecord(entry: DiaryEntry) {
    return confirmDestructiveAction({ title: t("ko", "diary.deleteTitle"), message: t("ko", "diary.deleteCopy"), cancelText: t("ko", "diary.deleteCancel"), confirmText: t("ko", "diary.deleteConfirm") }, async () => {
      if (databaseMode) {
        try {
          await deleteDiaryEntry.mutateAsync(entry.id);
          onNotice(t("ko", "today.diaryDeletedRemote")); return true;
        } catch (error) {
          onNotice(error instanceof Error ? error.message : t("ko", "diary.deleteFailed"), "error"); return false;
        }
      }

      const nextEntries = entries.filter((item) => item.id !== entry.id);
      setEntries(nextEntries);
      onLocalEntriesChanged(nextEntries);
      onNotice(t("ko", "today.diaryDeleted")); return true;
    });
  }

  return {
    entries,
    replaceLocalEntries: setEntries,
    activeEntries,
    selectedDiaryEntries,
    selectedDiaryStatus,
    refetchSelectedDiary,
    latestConditionScore,
    selectedDiaryDate,
    setSelectedDiaryDate,
    diaryFilter,
    setDiaryFilter,
    timelineEditEntry,
    setTimelineEditEntry,
    saveDiaryEntry,
    updateDiaryRecord,
    deleteDiaryRecord,
    createEntryRemote: createDiaryEntry.mutateAsync,
    deleteEntryRemote: deleteDiaryEntry.mutateAsync,
  };
}

export { getTodayEntriesForPet };
