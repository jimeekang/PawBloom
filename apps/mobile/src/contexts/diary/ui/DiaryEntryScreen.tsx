import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { DiaryCategory, DiaryDetailInput, DiaryEntry, DiaryPhotoInput } from "../domain/diaryEntry";
import { buildRoutineDiaryDetail, getDiaryCategoriesForSpecies } from "./diaryFormDefaults";
import type { Species } from "../../pet/domain/pet";
import type { PetRoutine } from "../../routine/domain/petRoutine";
import { categoryVisuals } from "../../../design-system/categoryVisuals";
import { NoticeBanner } from "../../../design-system/components";
import { AppIcon } from "../../../design-system/iconography";
import { colors, iconSize } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";
import type { DraftDiaryEntry } from "./draftDiaryEntry";
import { DiaryCalendar, type DiaryFilter } from "./DiaryCalendar";
import { createDefaultDiaryDetail, DiaryDetailPanel } from "./DiaryDetailPanel";
import { DiaryEntryList } from "./DiaryEntryList";
import { findEditableDailyStructuredEntry, formatDiaryTime, getDiaryEntryDateForSave, getEditableDiaryMemo, isDiaryDetailPanelOpenAfterSave, normalizeDiaryTimeInput, resolveDiarySaveTime, resolvePendingDiaryCreateMutation, shouldApplyInitialEditingEntry, shouldResetDiaryCategorySelection } from "./DiaryEntryScreen.logic";
import { getDiaryCategoryFormState, getDiaryDetailForSave, getDiaryPhotosForSave, getDiarySummaryForSave } from "./DiaryEntryScreen.formRules";
import { styles } from "./DiaryEntryScreen.styles";
import { TimePickerField } from "../../../design-system/TimePickerField";
import { createUuid } from "../../../shared-kernel/uuid";
import { DiaryConditionScore } from "./DiaryConditionScore";
import { DiaryEntryActions } from "./DiaryEntryActions";
import { DiaryPhotoSection } from "./DiaryPhotoSection";
import { countSavedDiaryPhotosForDate, MAX_DIARY_PHOTOS } from "./DiaryPhotoPicker.logic";
export function DiaryEntryScreen({
  entries,
  selectedDateKey,
  filter,
  onDateChange,
  onFilterChange,
  onSave,
  onUpdate,
  onDelete,
  routine,
  petSpecies,
  initialEditingEntry,
  onInitialEditingEntryConsumed,
  canCreate = true,
  canUpdate = true,
  canDelete = true,
}: {
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
  const [notice, setNotice] = useState<string>(t("ko", "diary.localDraft"));
  const [isDetailPanelOpen, setDetailPanelOpen] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const pendingSaveMutation = useRef<{ fingerprint: string; id: string } | null>(null);
  const categories = useMemo(() => getDiaryCategoriesForSpecies(petSpecies, routine?.walk.enabled) as DiaryCategory[], [petSpecies, routine?.walk.enabled]);
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
    if (!initialEditingEntry) {
      setLastAppliedInitialEditingEntryId(null);
      return;
    }
    if (!canUpdate) {
      setNotice(t("ko", "permission.diaryUpdateCareTeamOnly"));
      onInitialEditingEntryConsumed?.();
      return;
    }
    if (!shouldApplyInitialEditingEntry({ nextEntryId: initialEditingEntry.id, currentEditingEntryId: editingEntry?.id, lastAppliedEntryId: lastAppliedInitialEditingEntryId })) return;
    loadEditingEntry(initialEditingEntry);
    setLastAppliedInitialEditingEntryId(initialEditingEntry.id);
    onInitialEditingEntryConsumed?.();
  }, [canUpdate, editingEntry?.id, initialEditingEntry, lastAppliedInitialEditingEntryId, onInitialEditingEntryConsumed, routine]);
  function selectCategory(category: DiaryCategory) {
    if (!editingEntry) { setSelected(category); setDetail(createDetailForCategory(category, routine)); setDetailPanelOpen(true); }
  }
  async function saveEntry() {
    if (savingRef.current) return;
    if (editingEntry && !canUpdate) { setNotice(t("ko", "permission.diaryUpdateCareTeamOnly")); return; }
    if (!editingEntry && !canCreate) { setNotice(t("ko", "permission.diaryUpdateCareTeamOnly")); return; }
    if (selected === "photo" && savedPhotoCount + photos.length > MAX_DIARY_PHOTOS) { setNotice(t("ko", "diary.photoLimitNotice")); return; }
    if (!editingEntry && selected === "photo" && savedPhotoCount >= MAX_DIARY_PHOTOS) { setNotice(t("ko", "diary.photoLimitNotice")); return; }
    if (!editingEntry && selected === "photo" && photos.length === 0) { setNotice(t("ko", "diary.photoRequired")); return; }
    const activeDetail = detail.category === selected ? detail : createDetailForCategory(selected, routine);
    const saveTime = resolveDiarySaveTime(occurredTime, Boolean(editingEntry) || timeDirty);
    if (!saveTime) { setNotice(t("ko", "diary.invalidTime")); return; }
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
        setNotice(t("ko", "diary.updatedForDate"));
      } else {
        const existingDailyEntry = findEditableDailyStructuredEntry(entries, selected, draft.entryDate ?? selectedDateKey);
        if (existingDailyEntry) {
          if (!canUpdate) {
            setNotice(t("ko", "permission.diaryUpdateCareTeamOnly"));
            return;
          }
          await onUpdate({ id: existingDailyEntry.id, ...draft, occurredTime: saveTime });
          setNotice(t("ko", "diary.updatedForDate"));
        } else {
          const outcome = await onSave(draft);
          setNotice(t("ko", outcome === "queued" ? "diary.queuedForSync" : "diary.savedForDate"));
        }
      }
    } catch {
      setNotice(t("ko", editingEntry ? "diary.updateFailed" : "diary.saveFailed"));
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
    setNotice(t("ko", "diary.editingNotice"));
  }

  function editEntry(entry: DiaryEntry) {
    if (!canUpdate) {
      setNotice(t("ko", "permission.diaryUpdateCareTeamOnly"));
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
    setNotice(t("ko", "diary.localDraft"));
  }

  async function deleteEditingEntry() {
    if (!editingEntry || !canDelete) return;
    try {
      const deleted = await onDelete(editingEntry);
      if (deleted !== false) cancelEdit();
    } catch {
      setNotice(t("ko", "diary.deleteFailed"));
    }
  }

  return (
    <View style={styles.screen}>
      <DiaryCalendar selectedDateKey={selectedDateKey} filter={filter} onSelectDate={onDateChange} onFilterChange={onFilterChange} />
      <NoticeBanner text={notice} icon="shield" />

      <Text style={styles.sectionTitle}>{t("ko", "diary.category")}</Text>
      <View style={styles.categoryGrid}>
        {categories.map((key) => {
          const item = categoryVisuals[key];
          const active = selected === key;
          return (
            <Pressable key={key} disabled={Boolean(editingEntry)} style={[styles.categoryTile, active && styles.categoryTileActive]} onPress={() => selectCategory(key)}>
              <AppIcon name={item.icon} size={iconSize.xl} color={item.color} />
              <Text style={styles.categoryLabel}>{t("ko", item.labelKey)}</Text>
            </Pressable>
          );
        })}
      </View>

      {isDetailPanelOpen && formState.showsDetail && selected === "condition" ? <DiaryConditionScore value={conditionScore} onChange={setConditionScore} /> : null}
      {isDetailPanelOpen && formState.showsDetail ? <DiaryDetailPanel category={selected} detail={detail} onChange={setDetail} /> : null}

      {formState.showsPhotos ? (
        <DiaryPhotoSection editingEntry={editingEntry} savedPhotoCount={savedPhotoCount} photos={photos} onChange={setPhotos} onNotice={setNotice} />
      ) : null}

      {formState.showsMemo ? (
        <>
          <Text style={styles.sectionTitle}>{t("ko", "diary.memo")}</Text>
          <View style={styles.memoBox}>
            <TextInput
              multiline
              placeholder={t("ko", "diary.memoPlaceholder")}
              placeholderTextColor={colors.textSoft}
              value={memo}
              onChangeText={(value) => setMemo(value.slice(0, 500))}
              style={styles.memoInput}
            />
            <Text style={styles.counter}>{memo.length}/500</Text>
          </View>
        </>
      ) : null}

      <Text style={styles.sectionTitle}>{t("ko", "diary.timeLabel")}</Text>
      <TimePickerField value={occurredTime} onChange={(value) => { setTimeDirty(true); setOccurredTime(value); }} />

      <DiaryEntryActions editing={Boolean(editingEntry)} isSaving={isSaving} saveBlockedByRole={saveBlockedByRole} canDelete={canDelete} onSave={() => void saveEntry()} onCancel={cancelEdit} onDelete={() => void deleteEditingEntry()} />
      <DiaryEntryList entries={entries} title={filter === "day" ? t("ko", "diary.selectedDateEntries") : t("ko", "diary.selectedWeekEntries")} onEntryPress={canUpdate ? editEntry : undefined} />
    </View>
  );
}
function createDetailForCategory(category: DiaryCategory, routine?: PetRoutine): DiaryDetailInput {
  if (routine && category !== "memo" && category !== "photo") return buildRoutineDiaryDetail(category, routine);
  return createDefaultDiaryDetail(category);
}
