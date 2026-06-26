import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { DiaryCategory, DiaryEntry, DiaryPhotoInput } from "../../contexts/diary/domain/diaryEntry";
import { categoryVisuals } from "../../design-system/categoryVisuals";
import { NoticeBanner, PrimaryButton, SegmentedControl } from "../../design-system/components";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize, radius, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import type { DraftDiaryEntry } from "../mockUiState";
import { DiaryCalendar, type DiaryFilter } from "./DiaryCalendar";
import { DiaryEntryList } from "./DiaryEntryList";
import { DiaryPhotoPicker } from "./DiaryPhotoPicker";

type DiaryMode = "daily" | "care";

const dailyCategories: DiaryCategory[] = ["food", "water", "walk", "stool", "condition", "memo"];
const careCategories: DiaryCategory[] = ["food", "water", "condition"];

export function DiaryEntryScreen({
  entries,
  selectedDateKey,
  filter,
  onDateChange,
  onFilterChange,
  onSave,
}: {
  entries: DiaryEntry[];
  selectedDateKey: string;
  filter: DiaryFilter;
  onDateChange: (dateKey: string) => void;
  onFilterChange: (filter: DiaryFilter) => void;
  onSave: (entry: DraftDiaryEntry) => void;
}) {
  const [mode, setMode] = useState<DiaryMode>("daily");
  const [selected, setSelected] = useState<DiaryCategory>("food");
  const [conditionScore, setConditionScore] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [memo, setMemo] = useState("");
  const [photos, setPhotos] = useState<DiaryPhotoInput[]>([]);
  const [notice, setNotice] = useState<string>(t("ko", "diary.localDraft"));
  const categories = mode === "care" ? careCategories : dailyCategories;

  useEffect(() => {
    if (!categories.includes(selected)) {
      setSelected(categories[0]);
    }
  }, [categories, selected]);

  function saveEntry() {
    onSave({
      category: selected,
      summary: memo.trim(),
      entryDate: selectedDateKey,
      occurredAt: formatCurrentTime(),
      conditionScore: selected === "condition" ? conditionScore : undefined,
      photos,
    });
    setMemo("");
    setPhotos([]);
    setNotice(t("ko", "diary.savedForDate"));
  }

  return (
    <View style={styles.screen}>
      <DiaryCalendar selectedDateKey={selectedDateKey} filter={filter} onSelectDate={onDateChange} onFilterChange={onFilterChange} />
      <NoticeBanner text={notice} icon="shield" />

      <SegmentedControl
        value={mode}
        onChange={setMode}
        items={[
          { label: t("ko", "diary.mode.daily"), value: "daily" },
          { label: t("ko", "diary.mode.care"), value: "care" },
        ]}
      />

      <Text style={styles.sectionTitle}>{t("ko", "diary.category")}</Text>
      <View style={styles.categoryGrid}>
        {categories.map((key) => {
          const item = categoryVisuals[key];
          const active = selected === key;
          return (
            <Pressable key={key} style={[styles.categoryTile, active && styles.categoryTileActive]} onPress={() => setSelected(key)}>
              <AppIcon name={item.icon} size={iconSize.xl} color={item.color} />
              <Text style={styles.categoryLabel}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {selected === "condition" ? <ConditionScore value={conditionScore} onChange={setConditionScore} /> : null}

      <Text style={styles.sectionTitle}>
        {t("ko", "diary.addPhotos")} <Text style={styles.optional}>{t("ko", "diary.optional")}</Text>
      </Text>
      <DiaryPhotoPicker photos={photos} onChange={setPhotos} onNotice={setNotice} />

      <Text style={styles.sectionTitle}>{mode === "care" ? t("ko", "diary.careMemo") : t("ko", "diary.memo")}</Text>
      <View style={styles.memoBox}>
        <TextInput
          multiline
          placeholder={mode === "care" ? t("ko", "diary.careMemoPlaceholder") : t("ko", "diary.memoPlaceholder")}
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
