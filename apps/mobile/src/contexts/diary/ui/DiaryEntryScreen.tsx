import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { DiaryCategory, DiaryDetailInput, DiaryEntry, DiaryPhotoInput } from "../domain/diaryEntry";
import { buildRoutineDiaryDetail, getDiaryCategoriesForSpecies } from "./diaryFormDefaults";
import type { Species } from "../../pet/domain/pet";
import type { PetRoutine } from "../../routine/domain/petRoutine";
import { categoryVisuals } from "../../../design-system/categoryVisuals";
import { NoticeBanner, PrimaryButton, SecondaryButton } from "../../../design-system/components";
import { AppIcon } from "../../../design-system/iconography";
import { colors, iconSize } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";
import type { DraftDiaryEntry } from "./draftDiaryEntry";
import { DiaryCalendar, type DiaryFilter } from "./DiaryCalendar";
import { createDefaultDiaryDetail, DiaryDetailPanel } from "./DiaryDetailPanel";
import { DiaryEntryList } from "./DiaryEntryList";
import { findEditableDailyStructuredEntry, formatDiaryTime, getDiaryEntryDateForSave, getEditableDiaryMemo, isDiaryDetailPanelOpenAfterSave, normalizeDiaryTimeInput, resolveDiarySaveTime, shouldApplyInitialEditingEntry } from "./DiaryEntryScreen.logic";
import { getDiaryCategoryFormState, getDiaryDetailForSave, getDiaryPhotosForSave, getDiarySummaryForSave } from "./DiaryEntryScreen.formRules";
import { styles } from "./DiaryEntryScreen.styles";
import { DiaryPhotoPicker } from "./DiaryPhotoPicker";
import { TimePickerField } from "../../../design-system/TimePickerField";

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
}: {
  entries: DiaryEntry[];
  selectedDateKey: string;
  filter: DiaryFilter;
  onDateChange: (dateKey: string) => void;
  onFilterChange: (filter: DiaryFilter) => void;
  onSave: (entry: DraftDiaryEntry) => void | Promise<void>;
  onUpdate: (entry: DraftDiaryEntry & { id: string; occurredTime: string }) => void | Promise<void>;
  onDelete: (entry: DiaryEntry) => void | Promise<boolean | void>;
  routine?: PetRoutine;
  petSpecies: Species;
  initialEditingEntry?: DiaryEntry | null;
  onInitialEditingEntryConsumed?: () => void;
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
  const categories = useMemo(() => getDiaryCategoriesForSpecies(petSpecies, routine?.walk.enabled) as DiaryCategory[], [petSpecies, routine?.walk.enabled]);
  const formState = getDiaryCategoryFormState(selected);

  useEffect(() => { if (!categories.includes(selected)) setSelected(categories[0]); }, [categories, selected]);

  useEffect(() => {
    if (!editingEntry) setDetail(createDetailForCategory(selected, routine));
  }, [editingEntry, routine, selected]);

  useEffect(() => {
    if (!initialEditingEntry) {
      setLastAppliedInitialEditingEntryId(null);
      return;
    }

    if (!shouldApplyInitialEditingEntry({ nextEntryId: initialEditingEntry.id, currentEditingEntryId: editingEntry?.id, lastAppliedEntryId: lastAppliedInitialEditingEntryId })) return;
    loadEditingEntry(initialEditingEntry);
    setLastAppliedInitialEditingEntryId(initialEditingEntry.id);
    onInitialEditingEntryConsumed?.();
  }, [editingEntry?.id, initialEditingEntry, lastAppliedInitialEditingEntryId, onInitialEditingEntryConsumed, routine]);

  function selectCategory(category: DiaryCategory) { setSelected(category); setDetail(createDetailForCategory(category, routine)); setDetailPanelOpen(true); }

  async function saveEntry() {
    const activeDetail = detail.category === selected ? detail : createDetailForCategory(selected, routine);
    const saveTime = resolveDiarySaveTime(occurredTime, Boolean(editingEntry) || timeDirty);
    if (!saveTime) { setNotice(t("ko", "diary.invalidTime")); return; }
    const draft = {
      category: selected,
      summary: getDiarySummaryForSave(selected, memo),
      detail: getDiaryDetailForSave(selected, activeDetail),
      entryDate: getDiaryEntryDateForSave(selectedDateKey, editingEntry),
      occurredAt: saveTime,
      origin: "diary" as const,
      conditionScore: selected === "condition" ? conditionScore : undefined,
      photos: getDiaryPhotosForSave(selected, photos, Boolean(editingEntry)),
    };

    try {
      if (editingEntry) {
        await onUpdate({ id: editingEntry.id, ...draft, occurredTime: saveTime });
        setEditingEntry(null);
        setNotice(t("ko", "diary.updatedForDate"));
      } else {
        const existingDailyEntry = findEditableDailyStructuredEntry(entries, selected, draft.entryDate ?? selectedDateKey);
        if (existingDailyEntry) {
          await onUpdate({ id: existingDailyEntry.id, ...draft, occurredTime: saveTime });
          setNotice(t("ko", "diary.updatedForDate"));
        } else {
          await onSave(draft);
          setNotice(t("ko", "diary.savedForDate"));
        }
      }
    } catch { setNotice(t("ko", editingEntry ? "diary.updateFailed" : "diary.saveFailed")); return; }

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

  function editEntry(entry: DiaryEntry) { loadEditingEntry(entry); }

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
    if (!editingEntry) return;
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
            <Pressable key={key} style={[styles.categoryTile, active && styles.categoryTileActive]} onPress={() => selectCategory(key)}>
              <AppIcon name={item.icon} size={iconSize.xl} color={item.color} />
              <Text style={styles.categoryLabel}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {isDetailPanelOpen && formState.showsDetail && selected === "condition" ? <ConditionScore value={conditionScore} onChange={setConditionScore} /> : null}
      {isDetailPanelOpen && formState.showsDetail ? <DiaryDetailPanel category={selected} detail={detail} onChange={setDetail} /> : null}

      {formState.showsPhotos ? (
        <>
          <Text style={styles.sectionTitle}>
            {editingEntry ? t("ko", "diary.photos") : t("ko", "diary.addPhotos")} {!editingEntry ? <Text style={styles.optional}>{t("ko", "diary.optional")}</Text> : null}
          </Text>
          {editingEntry ? <Text style={styles.photoEditNotice}>{formatExistingPhotoNotice(editingEntry.photoCount)}</Text> : <DiaryPhotoPicker photos={photos} onChange={setPhotos} onNotice={setNotice} />}
        </>
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

      <View style={styles.actionStack}>
        <PrimaryButton label={editingEntry ? t("ko", "diary.update") : t("ko", "diary.save")} onPress={saveEntry} />
        {editingEntry ? <SecondaryButton label={t("ko", "diary.cancelEdit")} onPress={cancelEdit} /> : null}
        {editingEntry ? (
          <Pressable style={styles.dangerButton} onPress={deleteEditingEntry}>
            <AppIcon name="close" size={iconSize.sm} color={colors.coral} />
            <Text style={styles.dangerButtonText}>{t("ko", "diary.delete")}</Text>
          </Pressable>
        ) : null}
      </View>
      <DiaryEntryList entries={entries} title={filter === "day" ? t("ko", "diary.selectedDateEntries") : t("ko", "diary.selectedWeekEntries")} onEntryPress={editEntry} />
    </View>
  );
}

function createDetailForCategory(category: DiaryCategory, routine?: PetRoutine): DiaryDetailInput {
  if (routine && category !== "memo" && category !== "photo") return buildRoutineDiaryDetail(category, routine);
  return createDefaultDiaryDetail(category);
}

function formatExistingPhotoNotice(photoCount?: number) { return photoCount ? t("ko", "diary.existingPhotoCount").replace("{count}", String(photoCount)) : t("ko", "diary.photosUnchanged"); }

function ConditionScore({ value, onChange }: { value: 1 | 2 | 3 | 4 | 5; onChange: (value: 1 | 2 | 3 | 4 | 5) => void }) {
  return (
    <>
      <Text style={styles.sectionTitle}>{t("ko", "diary.conditionScore")}</Text>
      <View style={styles.scorePicker}>
        {[1, 2, 3, 4, 5].map((score) => (
          <Pressable key={score} style={[styles.scoreButton, value === score && styles.scoreButtonActive]} onPress={() => onChange(score as 1 | 2 | 3 | 4 | 5)}>
            <Text style={[styles.scoreText, value === score && styles.scoreTextActive]}>{score}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}
