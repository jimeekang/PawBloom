import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { DiaryCategory } from "../../contexts/diary/domain/diaryEntry";
import { categoryVisuals } from "../../design-system/categoryVisuals";
import { AppIcon } from "../../design-system/iconography";
import { NoticeBanner, PrimaryButton } from "../../design-system/components";
import { colors, iconSize, layout, radius, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import type { DraftDiaryEntry } from "../mockUiState";

const categories: DiaryCategory[] = ["food", "water", "walk", "stool", "condition", "memo"];

export function DiaryEntryScreen({ onSave }: { onSave: (entry: DraftDiaryEntry) => void }) {
  const [selected, setSelected] = useState<DiaryCategory>("food");
  const [conditionScore, setConditionScore] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [memo, setMemo] = useState("");
  const [photoAdded, setPhotoAdded] = useState(false);
  const [notice, setNotice] = useState(t("ko", "diary.localDraft"));

  function saveEntry() {
    onSave({ category: selected, summary: memo.trim(), occurredAt: t("ko", "diary.time"), conditionScore });
    setMemo("");
    setPhotoAdded(false);
  }

  return (
    <View style={styles.screen}>
      <NoticeBanner text={notice} icon="shield" />

      <View style={styles.dateTimeRow}>
        <ControlPill iconName="calendar" label={t("ko", "diary.date")} wide />
        <ControlPill iconName="time" label={t("ko", "diary.time")} />
      </View>

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

      {selected === "condition" ? (
        <>
          <Text style={styles.sectionTitle}>{t("ko", "diary.conditionScore")}</Text>
          <View style={styles.scorePicker}>
            {[1, 2, 3, 4, 5].map((score) => (
              <Pressable
                key={score}
                style={[styles.scoreButton, conditionScore === score && styles.scoreButtonActive]}
                onPress={() => setConditionScore(score as 1 | 2 | 3 | 4 | 5)}
              >
                <Text style={[styles.scoreText, conditionScore === score && styles.scoreTextActive]}>{score}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <Text style={styles.sectionTitle}>
        {t("ko", "diary.addPhotos")} <Text style={styles.optional}>{t("ko", "diary.optional")}</Text>
      </Text>
      <Pressable
        style={[styles.photoDrop, photoAdded && styles.photoDropActive]}
        onPress={() => {
          setPhotoAdded((value) => !value);
          setNotice(photoAdded ? t("ko", "diary.photoRemovedNotice") : t("ko", "diary.photoAddedNotice"));
        }}
      >
        <AppIcon name={photoAdded ? "check" : "addPhoto"} size={42} color={photoAdded ? colors.mintDeep : colors.textSoft} />
        <Text style={styles.photoTitle}>{photoAdded ? t("ko", "diary.photoAdded") : t("ko", "diary.photoAdd")}</Text>
        <Text style={styles.photoCopy}>{photoAdded ? t("ko", "diary.photoLater") : t("ko", "diary.photoDrop")}</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>
        {t("ko", "diary.memo")} <Text style={styles.optional}>{t("ko", "diary.optional")}</Text>
      </Text>
      <View style={styles.memoBox}>
        <TextInput
          multiline
          placeholder={t("ko", "diary.memoPlaceholder")}
          placeholderTextColor={colors.textSoft}
          value={memo}
          onChangeText={(value) => setMemo(value.slice(0, 300))}
          style={styles.memoInput}
        />
        <Text style={styles.counter}>{memo.length}/300</Text>
      </View>

      <PrimaryButton label={t("ko", "diary.save")} onPress={saveEntry} />
    </View>
  );
}

function ControlPill({ iconName, label, wide = false }: { iconName: "calendar" | "time"; label: string; wide?: boolean }) {
  return (
    <View style={[styles.controlPill, wide && styles.controlPillWide]}>
      <AppIcon name={iconName} size={iconSize.sm} color={colors.text} />
      <Text style={styles.controlLabel}>{label}</Text>
      {wide ? <AppIcon name="chevronDown" size={iconSize.sm} color={colors.text} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.lg,
  },
  dateTimeRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  controlPill: {
    minHeight: layout.inputHeight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  controlPillWide: {
    flex: 1,
    justifyContent: "space-between",
  },
  controlLabel: {
    ...type.body,
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
  photoDrop: {
    minHeight: 168,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderDashed,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  photoDropActive: {
    borderStyle: "solid",
    borderColor: colors.mint,
    backgroundColor: colors.surfaceWarm,
  },
  photoTitle: {
    ...type.bodyStrong,
    color: colors.textMuted,
  },
  photoCopy: {
    ...type.caption,
  },
  memoBox: {
    minHeight: 86,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  memoInput: {
    ...type.body,
    minHeight: 46,
    textAlignVertical: "top",
  },
  counter: {
    ...type.caption,
    textAlign: "right",
  },
});
