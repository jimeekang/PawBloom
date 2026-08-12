import { useEffect, useMemo, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import type { DiaryCategory, DiaryDetailInput, DiaryEntry, DiaryPhotoInput } from "../domain/diaryEntry";
import { buildRoutineDiaryDetail, getDiaryCategoriesForSpecies } from "./diaryFormDefaults";
import type { Species } from "../../pet/domain/pet";
import type { PetRoutine } from "../../routine/domain/petRoutine";
import { NoticeBanner, type NoticeTone } from "../../../design-system/components";
import { colors } from "../../../design-system/tokens";
import { t, type TranslationKey } from "../../../i18n/translations";
import type { DraftDiaryEntry } from "./draftDiaryEntry";
import { DiaryCalendar, type DiaryFilter } from "./DiaryCalendar";
import { createDefaultDiaryDetail, DiaryDetailPanel } from "./DiaryDetailPanel";
import { DiaryEntryList } from "./DiaryEntryList";
import { findEditableDailyStructuredEntry, formatDiaryTime, getDiaryEntryDateForSave, getDiarySavedNoticeKey, getEditableDiaryMemo, isDiaryDetailPanelOpenAfterSave, normalizeDiaryTimeInput, resolveDiarySaveTime, resolvePendingDiaryCreateMutation, shouldApplyInitialEditingEntry, shouldResetDiaryCategorySelection } from "./DiaryEntryScreen.logic";
import { getDiaryCategoryFormState, getDiaryDetailForSave, getDiaryPhotosForSave, getDiarySummaryForSave } from "./DiaryEntryScreen.formRules";
import { styles } from "./DiaryEntryScreen.styles";
import { TimePickerField } from "../../../design-system/TimePickerField";
import { createUuid } from "../../../shared-kernel/uuid";
import { DiaryCategoryPicker } from "./DiaryCategoryPicker";
import { DiaryConditionScore } from "./DiaryConditionScore";
import { DiaryEntryActions } from "./DiaryEntryActions";
import { DiaryPhotoSection } from "./DiaryPhotoSection";
import { countSavedDiaryPhotosForDate, MAX_DIARY_PHOTOS } from "./DiaryPhotoPicker.logic";
export function DiaryEntryScreen({
  petId, entries, selectedDateKey, filter, onDateChange, onFilterChange,
  onSave, onUpdate, onDelete, routine, petSpecies, initialEditingEntry,
  onInitialEditingEntryConsumed, canCreate = true, canUpdate = true, canDelete = true,
  listStatus = "ready", onRetryList,
}: {
  petId: string;
  entries: DiaryEntry[];
  selectedDateKey: string;
  filter: DiaryFilter;
  onDateChange: (dateKey: string) => void;
  onFilterChange: (filter: DiaryFilter) => void;
  onSave: (entry: DraftDiaryEntry) => "saved" | "queued" | void | Promise<"saved" | "queued" | void>;
  onUpdate: (entry: DraftDiaryEntry & { id: string; occurredTime: string }) => void | Promise<void>;
  onDelete: (entry: DiaryEntry) => void | Promise<boolean | void>;
  routine?: PetRoutine;
  petSpecies: Species;
  initialEditingEntry?: DiaryEntry | null;
  onInitialEditingEntryConsumed?: () => void;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  listStatus?: "ready" | "loading" | "error";
  onRetryList?: () => void;
}) {
  const [selected, setSelected] = useState<DiaryCategory>("food");
  const [conditionScore, setConditionScore] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [detail, setDetail] = useState<DiaryDetailInput>(createDefaultDiaryDetail("food"));
  const [memo, setMemo] = useState("");
  const [photos, setPhotos] = useState<DiaryPhotoInput[]>([]);
  const [occurredTime, setOccurredTime] = useState(formatDiaryTime());
  const [timeDirty, setTimeDirty] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [lastAppliedInitialEditingEntryId, setLastAppliedInitialEditingEntryId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ key: TranslationKey; tone: NoticeTone }>({ key: "diary.localDraft", tone: "success" });
  const [isDetailPanelOpen, setDetailPanelOpen] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const pendingSaveMutation = useRef<{ fingerprint: string; id: string } | null>(null);
  const categories = useMemo(() => getDiaryCategoriesForSpecies(petSpecies, routine?.walk.enabled) as DiaryCategory[], [petSpecies, routine?.walk.enabled]);
  const activePetRef = useRef(petId);
  const formState = getDiaryCategoryFormState(selected);
  const existingStructuredEntry = editingEntry ? null : findEditableDailyStructuredEntry(entries, selected, selectedDateKey);
  const photoDateKey = editingEntry?.entryDate ?? selectedDateKey;
  const savedPhotoCount = useMemo(() => countSavedDiaryPhotosForDate(entries, photoDateKey, editingEntry), [editingEntry, entries, photoDateKey]);
  const saveBlockedByRole = editingEntry ? !canUpdate : existingStructuredEntry ? !canUpdate : !canCreate;
  useEffect(() => {
    if (shouldResetDiaryCategorySelection({ categories, selected, isEditing: Boolean(editingEntry) })) setSelected(categories[0]);
  }, [categories, editingEntry, selected]);
  useEffect(() => {
    if (!editingEntry) setDetail(createDetailForCategory(selected, routine));
  }, [editingEntry, routine, selected]);
  useEffect(() => {
    if (activePetRef.current === petId) return;
    activePetRef.current = petId;
    setEditingEntry(null); setLastAppliedInitialEditingEntryId(null); setSelected(categories[0]); setConditionScore(3);
    setDetail(createDetailForCategory(categories[0], routine)); setMemo(""); setPhotos([]); setOccurredTime(formatDiaryTime()); setTimeDirty(false);
    pendingSaveMutation.current = null; setDetailPanelOpen(true); showNotice("diary.localDraft"); onInitialEditingEntryConsumed?.();
  }, [categories, onInitialEditingEntryConsumed, petId, routine]);
  useEffect(() => {
    if (!initialEditingEntry) {
      setLastAppliedInitialEditingEntryId(null);
      return;
    }
    if (initialEditingEntry.petId !== petId) { onInitialEditingEntryConsumed?.(); return; }
    if (!canUpdate) {
      showNotice("permission.diaryUpdateCareTeamOnly", "error");
      onInitialEditingEntryConsumed?.();
      return;
    }
    if (!shouldApplyInitialEditingEntry({ nextEntryId: initialEditingEntry.id, currentEditingEntryId: editingEntry?.id, lastAppliedEntryId: lastAppliedInitialEditingEntryId })) return;
    loadEditingEntry(initialEditingEntry);
    setLastAppliedInitialEditingEntryId(initialEditingEntry.id);
    onInitialEditingEntryConsumed?.();
  }, [canUpdate, editingEntry?.id, initialEditingEntry, lastAppliedInitialEditingEntryId, onInitialEditingEntryConsumed, petId, routine]);
  function showNotice(key: TranslationKey, tone: NoticeTone = "success") {
    setNotice({ key, tone });
  }
  function savedNoticeKey(savedDate: string | undefined, editing: boolean) {
    return getDiarySavedNoticeKey(savedDate ?? selectedDateKey, editing);
  }
  function selectCategory(category: DiaryCategory) {
    if (!editingEntry) { setSelected(category); setDetail(createDetailForCategory(category, routine)); setDetailPanelOpen(true); }
  }
  async function saveEntry() {
    if (savingRef.current) return;
    if (editingEntry && !canUpdate) { showNotice("permission.diaryUpdateCareTeamOnly", "error"); return; }
    if (!editingEntry && !canCreate) { showNotice("permission.diaryUpdateCareTeamOnly", "error"); return; }
    if (selected === "photo" && savedPhotoCount + photos.length > MAX_DIARY_PHOTOS) { showNotice("diary.photoLimitNotice", "error"); return; }
    if (!editingEntry && selected === "photo" && savedPhotoCount >= MAX_DIARY_PHOTOS) { showNotice("diary.photoLimitNotice", "error"); return; }
    if (!editingEntry && selected === "photo" && photos.length === 0) { showNotice("diary.photoRequired", "error"); return; }
    const activeDetail = detail.category === selected ? detail : createDetailForCategory(selected, routine);
    const saveTime = resolveDiarySaveTime(occurredTime, Boolean(editingEntry) || timeDirty);
    if (!saveTime) { showNotice("diary.invalidTime", "error"); return; }
    const draftFingerprint = JSON.stringify({ selected, memo, activeDetail, selectedDateKey, saveTime, conditionScore, photos: photos.map((photo) => [photo.uri, photo.fileName, photo.mimeType]) });
    const nextSaveMutation = !editingEntry || selected === "photo" ? resolvePendingDiaryCreateMutation(pendingSaveMutation.current, draftFingerprint, createUuid) : null;
    const clientMutationId = nextSaveMutation?.id;
    const draft = {
      category: selected,
      summary: getDiarySummaryForSave(selected, memo),
      detail: getDiaryDetailForSave(selected, activeDetail),
      entryDate: getDiaryEntryDateForSave(selectedDateKey, editingEntry),
      occurredAt: saveTime,
      origin: "diary" as const,
      conditionScore: selected === "condition" ? conditionScore : undefined,
      photos: getDiaryPhotosForSave(selected, photos, Boolean(editingEntry)),
      clientMutationId,
    };
    if (nextSaveMutation) pendingSaveMutation.current = nextSaveMutation;
    savingRef.current = true;
    setIsSaving(true);
    try {
      if (editingEntry) {
        await onUpdate({ id: editingEntry.id, ...draft, occurredTime: saveTime });
        setEditingEntry(null);
        showNotice(savedNoticeKey(draft.entryDate, true));
      } else {
        const existingDailyEntry = findEditableDailyStructuredEntry(entries, selected, draft.entryDate ?? selectedDateKey);
        if (existingDailyEntry) {
          if (!canUpdate) {
            showNotice("permission.diaryUpdateCareTeamOnly", "error");
            return;
          }
          await onUpdate({ id: existingDailyEntry.id, ...draft, occurredTime: saveTime });
          showNotice(savedNoticeKey(draft.entryDate, true));
        } else {
          const outcome = await onSave(draft);
          showNotice(outcome === "queued" ? "diary.queuedForSync" : savedNoticeKey(draft.entryDate, false));
        }
      }
    } catch {
      showNotice(editingEntry ? "diary.updateFailed" : "diary.saveFailed", "error");
      return;
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
    pendingSaveMutation.current = null;
    setMemo("");
    setDetail(createDetailForCategory(selected, routine));
    setPhotos([]);
    setOccurredTime(formatDiaryTime());
    setTimeDirty(false);
    setDetailPanelOpen(isDiaryDetailPanelOpenAfterSave(isDetailPanelOpen));
  }
  function loadEditingEntry(entry: DiaryEntry) {
    setEditingEntry(entry);
    setSelected(entry.category);
    setDetail(entry.detail ?? createDetailForCategory(entry.category, routine));
    setMemo(getEditableDiaryMemo(entry));
    setConditionScore(entry.conditionScore ?? 3);
    setPhotos([]);
    setOccurredTime(normalizeDiaryTimeInput(entry.occurredAt) ?? formatDiaryTime());
    setTimeDirty(false);
    setDetailPanelOpen(true);
    showNotice("diary.editingNotice");
  }

  function editEntry(entry: DiaryEntry) {
    if (!canUpdate) {
      showNotice("permission.diaryUpdateCareTeamOnly", "error");
      return;
    }
    loadEditingEntry(entry);
  }

  function cancelEdit() {
    setEditingEntry(null);
    setMemo("");
    setPhotos([]);
    setOccurredTime(formatDiaryTime());
    setTimeDirty(false);
    setDetail(createDetailForCategory(selected, routine));
    setDetailPanelOpen(false);
    showNotice("diary.localDraft");
  }

  async function deleteEditingEntry() {
    if (!editingEntry || !canDelete) return;
    try {
      const deleted = await onDelete(editingEntry);
      if (deleted !== false) cancelEdit();
    } catch {
      showNotice("diary.deleteFailed", "error");
    }
  }

  return (
    <View style={styles.screen}>
      <DiaryCalendar selectedDateKey={selectedDateKey} filter={filter} onSelectDate={onDateChange} onFilterChange={onFilterChange} />
      <NoticeBanner text={t(notice.key)} icon={notice.tone === "error" ? "close" : "check"} tone={notice.tone} />

      <Text style={styles.sectionTitle}>{t("diary.category")}</Text>
      <DiaryCategoryPicker categories={categories} selected={selected} disabled={Boolean(editingEntry)} onSelect={selectCategory} />

      {isDetailPanelOpen && formState.showsDetail && selected === "condition" ? <DiaryConditionScore value={conditionScore} onChange={setConditionScore} /> : null}
      {isDetailPanelOpen && formState.showsDetail ? <DiaryDetailPanel category={selected} detail={detail} onChange={setDetail} /> : null}

      {formState.showsPhotos ? (
        <DiaryPhotoSection editingEntry={editingEntry} savedPhotoCount={savedPhotoCount} photos={photos} onChange={setPhotos} onNotice={showNotice} />
      ) : null}

      {formState.showsMemo ? (
        <>
          <Text style={styles.sectionTitle}>{t("diary.memo")}</Text>
          <View style={styles.memoBox}>
            <TextInput
              accessibilityLabel={t("diary.memo")}
              multiline
              placeholder={t("diary.memoPlaceholder")}
              placeholderTextColor={colors.textSoft}
              value={memo}
              onChangeText={(value) => setMemo(value.slice(0, 500))}
              style={styles.memoInput}
            />
            <Text style={styles.counter}>{memo.length}/500</Text>
          </View>
        </>
      ) : null}

      <Text style={styles.sectionTitle}>{t("diary.timeLabel")}</Text>
      <TimePickerField accessibilityLabel={t("diary.timeLabel")} value={occurredTime} onChange={(value) => { setTimeDirty(true); setOccurredTime(value); }} />

      <DiaryEntryActions editing={Boolean(editingEntry)} isSaving={isSaving} saveBlockedByRole={saveBlockedByRole} canDelete={canDelete} onSave={() => void saveEntry()} onCancel={cancelEdit} onDelete={() => void deleteEditingEntry()} />
      <DiaryEntryList entries={entries} title={filter === "day" ? t("diary.selectedDateEntries") : t("diary.selectedWeekEntries")} onEntryPress={canUpdate ? editEntry : undefined} showEntryDate={filter === "week"} status={listStatus} onRetry={onRetryList} />
    </View>
  );
}
function createDetailForCategory(category: DiaryCategory, routine?: PetRoutine): DiaryDetailInput {
  if (routine && category !== "memo" && category !== "photo") return buildRoutineDiaryDetail(category, routine);
  return createDefaultDiaryDetail(category);
}
