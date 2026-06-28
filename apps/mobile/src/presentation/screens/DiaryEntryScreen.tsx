import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { DiaryCategory, DiaryDetailInput, DiaryEntry, DiaryPhotoInput } from "../../contexts/diary/domain/diaryEntry";
import { buildRoutineDiaryDetail, getDiaryCategoriesForSpecies } from "../../contexts/routine/application/petRoutineRecords";
import type { Species } from "../../contexts/pet/domain/pet";
import type { PetRoutine } from "../../contexts/routine/domain/petRoutine";
import { categoryVisuals } from "../../design-system/categoryVisuals";
import { NoticeBanner, PrimaryButton, SecondaryButton } from "../../design-system/components";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize, radius, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import type { DraftDiaryEntry } from "../mockUiState";
import { DiaryCalendar, type DiaryFilter } from "./DiaryCalendar";
import { createDefaultDiaryDetail, DiaryDetailPanel } from "./DiaryDetailPanel";
import { DiaryEntryList } from "./DiaryEntryList";
import { DiaryPhotoPicker } from "./DiaryPhotoPicker";

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
}) {
  const [selected, setSelected] = useState<DiaryCategory>("food");
  const [conditionScore, setConditionScore] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [detail, setDetail] = useState<DiaryDetailInput>(createDefaultDiaryDetail("food"));
  const [memo, setMemo] = useState("");
  const [photos, setPhotos] = useState<DiaryPhotoInput[]>([]);
  const [occurredTime, setOccurredTime] = useState(formatDiaryTime());
  const [timeDirty, setTimeDirty] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [notice, setNotice] = useState<string>(t("ko", "diary.localDraft"));
  const [isDetailPanelOpen, setDetailPanelOpen] = useState(true);
  const categories = useMemo(() => getDiaryCategoriesForSpecies(petSpecies, routine?.walk.enabled) as DiaryCategory[], [petSpecies, routine?.walk.enabled]);

  useEffect(() => { if (!categories.includes(selected)) setSelected(categories[0]); }, [categories, selected]);

  useEffect(() => {
    if (!editingEntry) setDetail(createDetailForCategory(selected, routine));
  }, [editingEntry, routine, selected]);

  function selectCategory(category: DiaryCategory) { setSelected(category); setDetail(createDetailForCategory(category, routine)); setDetailPanelOpen(true); }

  async function saveEntry() {
    const activeDetail = detail.category === selected ? detail : createDetailForCategory(selected, routine);
    const saveTime = resolveDiarySaveTime(occurredTime, Boolean(editingEntry) || timeDirty);
    if (!saveTime) { setNotice(t("ko", "diary.invalidTime")); return; }
    const draft = {
      category: selected,
      summary: memo.trim(),
      detail: selected === "memo" ? undefined : activeDetail,
      entryDate: getDiaryEntryDateForSave(selectedDateKey, editingEntry),
      occurredAt: saveTime,
      conditionScore: selected === "condition" ? conditionScore : undefined,
      photos: editingEntry ? undefined : photos,
    };

    try {
      if (editingEntry) {
        await onUpdate({ id: editingEntry.id, ...draft, occurredTime: saveTime });
        setEditingEntry(null);
        setNotice(t("ko", "diary.updatedForDate"));
      } else {
        await onSave(draft);
        setNotice(t("ko", "diary.savedForDate"));
      }
    } catch { setNotice(t("ko", editingEntry ? "diary.updateFailed" : "diary.saveFailed")); return; }

    setMemo("");
    setDetail(createDetailForCategory(selected, routine));
    setPhotos([]);
    setOccurredTime(formatDiaryTime());
    setTimeDirty(false);
    setDetailPanelOpen(isDiaryDetailPanelOpenAfterSave(isDetailPanelOpen));
  }

  function editEntry(entry: DiaryEntry) {
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

      {isDetailPanelOpen && selected === "condition" ? <ConditionScore value={conditionScore} onChange={setConditionScore} /> : null}
      {isDetailPanelOpen ? <DiaryDetailPanel category={selected} detail={detail} onChange={setDetail} /> : null}

      <Text style={styles.sectionTitle}>
        {editingEntry ? t("ko", "diary.photos") : t("ko", "diary.addPhotos")} {!editingEntry ? <Text style={styles.optional}>{t("ko", "diary.optional")}</Text> : null}
      </Text>
      {editingEntry ? <Text style={styles.photoEditNotice}>{formatExistingPhotoNotice(editingEntry.photoCount)}</Text> : <DiaryPhotoPicker photos={photos} onChange={setPhotos} onNotice={setNotice} />}

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

      <Text style={styles.sectionTitle}>{t("ko", "diary.timeLabel")}</Text>
      <TextInput
        placeholder={t("ko", "diary.time")}
        placeholderTextColor={colors.textSoft}
        value={occurredTime}
        onChangeText={(value) => { setTimeDirty(true); setOccurredTime(value.replace(/[^\d:]/g, "").slice(0, 5)); }}
        keyboardType="numbers-and-punctuation"
        style={styles.timeInput}
      />

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
  if (routine && category !== "memo") return buildRoutineDiaryDetail(category, routine);
  return createDefaultDiaryDetail(category);
}

export function isDiaryDetailPanelOpenAfterSave(_wasOpen: boolean) {
  return false;
}

export function normalizeDiaryTimeInput(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function resolveDiarySaveTime(value: string, mustUseInput: boolean, now = new Date()) {
  const normalized = normalizeDiaryTimeInput(value);
  if (mustUseInput && !normalized) return undefined;
  return mustUseInput ? normalized : formatDiaryTime(now);
}

export function getDiaryEntryDateForSave(selectedDateKey: string, editingEntry?: Pick<DiaryEntry, "entryDate"> | null) { return editingEntry?.entryDate ?? selectedDateKey; }
export function getEditableDiaryMemo(entry: DiaryEntry) { return entry.memo ?? (entry.detail ? "" : entry.summary); }
function formatExistingPhotoNotice(photoCount?: number) { return photoCount ? t("ko", "diary.existingPhotoCount").replace("{count}", String(photoCount)) : t("ko", "diary.photosUnchanged"); }

export function formatDiaryTime(date = new Date()) { return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`; }

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

const styles = StyleSheet.create({
  screen: { gap: spacing.lg },
  sectionTitle: { ...type.sectionTitle, marginTop: spacing.xs },
  optional: { ...type.body, color: colors.textMuted },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.lg },
  categoryTile: { width: "29.5%", aspectRatio: 1, minHeight: 92, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  categoryTileActive: { backgroundColor: colors.surfacePeach, borderColor: colors.salmon },
  categoryLabel: { ...type.bodyStrong },
  scorePicker: { flexDirection: "row", gap: spacing.sm },
  scoreButton: { flex: 1, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  scoreButtonActive: { borderColor: colors.orange, backgroundColor: colors.surfacePeach },
  scoreText: { ...type.bodyStrong, color: colors.textMuted },
  scoreTextActive: { color: colors.orangeDeep },
  memoBox: { minHeight: 108, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, padding: spacing.md },
  memoInput: { ...type.body, minHeight: 68, textAlignVertical: "top" },
  counter: { ...type.caption, textAlign: "right" },
  photoEditNotice: { ...type.caption, color: colors.textMuted },
  timeInput: { ...type.body, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  actionStack: { gap: spacing.sm },
  dangerButton: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.coral, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: spacing.sm },
  dangerButtonText: { ...type.bodyStrong, color: colors.coral },
});
