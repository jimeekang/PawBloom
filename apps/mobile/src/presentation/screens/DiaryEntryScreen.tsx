import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { DiaryCategory, DiaryDetailInput, DiaryEntry, DiaryPhotoInput } from "../../contexts/diary/domain/diaryEntry";
import { buildRoutineDiaryDetail, getDiaryCategoriesForSpecies } from "../../contexts/routine/application/petRoutineRecords";
import type { Species } from "../../contexts/pet/domain/pet";
import type { PetRoutine } from "../../contexts/routine/domain/petRoutine";
import { categoryVisuals } from "../../design-system/categoryVisuals";
import { NoticeBanner, PrimaryButton } from "../../design-system/components";
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
  routine,
  petSpecies,
}: {
  entries: DiaryEntry[];
  selectedDateKey: string;
  filter: DiaryFilter;
  onDateChange: (dateKey: string) => void;
  onFilterChange: (filter: DiaryFilter) => void;
  onSave: (entry: DraftDiaryEntry) => void;
  routine?: PetRoutine;
  petSpecies: Species;
}) {
  const [selected, setSelected] = useState<DiaryCategory>("food");
  const [conditionScore, setConditionScore] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [detail, setDetail] = useState<DiaryDetailInput>(createDefaultDiaryDetail("food"));
  const [memo, setMemo] = useState("");
  const [photos, setPhotos] = useState<DiaryPhotoInput[]>([]);
  const [notice, setNotice] = useState<string>(t("ko", "diary.localDraft"));
  const [isDetailPanelOpen, setDetailPanelOpen] = useState(true);
  const categories = useMemo(() => getDiaryCategoriesForSpecies(petSpecies, routine?.walk.enabled) as DiaryCategory[], [petSpecies, routine?.walk.enabled]);

  useEffect(() => {
    if (!categories.includes(selected)) {
      setSelected(categories[0]);
    }
  }, [categories, selected]);

  useEffect(() => {
    setDetail(createDetailForCategory(selected, routine));
  }, [routine, selected]);

  function selectCategory(category: DiaryCategory) {
    setSelected(category);
    setDetailPanelOpen(true);
  }

  function saveEntry() {
    const activeDetail = detail.category === selected ? detail : createDetailForCategory(selected, routine);
    onSave({
      category: selected,
      summary: memo.trim(),
      detail: selected === "memo" ? undefined : activeDetail,
      entryDate: selectedDateKey,
      occurredAt: formatCurrentTime(),
      conditionScore: selected === "condition" ? conditionScore : undefined,
      photos,
    });
    setMemo("");
    setDetail(createDetailForCategory(selected, routine));
    setPhotos([]);
    setDetailPanelOpen(isDiaryDetailPanelOpenAfterSave(isDetailPanelOpen));
    setNotice(t("ko", "diary.savedForDate"));
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
        {t("ko", "diary.addPhotos")} <Text style={styles.optional}>{t("ko", "diary.optional")}</Text>
      </Text>
      <DiaryPhotoPicker photos={photos} onChange={setPhotos} onNotice={setNotice} />

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

      <PrimaryButton label={t("ko", "diary.save")} onPress={saveEntry} />
      <DiaryEntryList entries={entries} title={filter === "day" ? t("ko", "diary.selectedDateEntries") : t("ko", "diary.selectedWeekEntries")} />
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

function formatCurrentTime() {
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.lg,
  },
  sectionTitle: {
    ...type.sectionTitle,
    marginTop: spacing.xs,
  },
  optional: {
    ...type.body,
    color: colors.textMuted,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.lg,
  },
  categoryTile: {
    width: "29.5%",
    aspectRatio: 1,
    minHeight: 92,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  categoryTileActive: {
    backgroundColor: colors.surfacePeach,
    borderColor: colors.salmon,
  },
  categoryLabel: {
    ...type.bodyStrong,
  },
  scorePicker: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  scoreButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreButtonActive: {
    borderColor: colors.orange,
    backgroundColor: colors.surfacePeach,
  },
  scoreText: {
    ...type.bodyStrong,
    color: colors.textMuted,
  },
  scoreTextActive: {
    color: colors.orangeDeep,
  },
  memoBox: {
    minHeight: 108,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  memoInput: {
    ...type.body,
    minHeight: 68,
    textAlignVertical: "top",
  },
  counter: {
    ...type.caption,
    textAlign: "right",
  },
});
