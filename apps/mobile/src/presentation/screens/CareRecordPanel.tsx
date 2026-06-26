import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { DiaryCategory, DiaryPhotoInput } from "../../contexts/diary/domain/diaryEntry";
import { categoryVisuals } from "../../design-system/categoryVisuals";
import { NoticeBanner, PrimaryButton, SurfaceCard } from "../../design-system/components";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize, radius, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import type { DraftDiaryEntry } from "../mockUiState";
import { DiaryPhotoPicker } from "./DiaryPhotoPicker";

const careCategories: DiaryCategory[] = ["food", "water", "condition"];

export function CareRecordPanel({ onSave }: { onSave: (entry: DraftDiaryEntry) => void }) {
  const [category, setCategory] = useState<DiaryCategory>("condition");
  const [conditionScore, setConditionScore] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [memo, setMemo] = useState("");
  const [photos, setPhotos] = useState<DiaryPhotoInput[]>([]);
  const [notice, setNotice] = useState<string>(t("ko", "care.recordNotice"));

  function saveRecord() {
    onSave({
      category,
      summary: memo.trim(),
      occurredAt: formatCurrentTime(),
      conditionScore: category === "condition" ? conditionScore : undefined,
      photos,
    });
    setMemo("");
    setPhotos([]);
    setNotice(t("ko", "care.recordSaved"));
  }

  return (
    <SurfaceCard>
      <View style={styles.wrap}>
        <Text style={styles.sectionTitle}>{t("ko", "care.recordTitle")}</Text>
        <NoticeBanner text={notice} icon="shield" />
        <View style={styles.categoryRow}>
          {careCategories.map((key) => {
            const item = categoryVisuals[key];
            const active = category === key;
            return (
              <Pressable key={key} style={[styles.categoryButton, active && styles.categoryButtonActive]} onPress={() => setCategory(key)}>
                <AppIcon name={item.icon} size={iconSize.md} color={item.color} />
                <Text style={styles.categoryLabel}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {category === "condition" ? <ScorePicker value={conditionScore} onChange={setConditionScore} /> : null}
        <TextInput
          multiline
          placeholder={t("ko", "care.recordMemoPlaceholder")}
          placeholderTextColor={colors.textSoft}
          value={memo}
          onChangeText={(value) => setMemo(value.slice(0, 500))}
          style={styles.memoInput}
        />
        <DiaryPhotoPicker photos={photos} onChange={setPhotos} onNotice={setNotice} />
        <PrimaryButton label={t("ko", "care.recordSave")} onPress={saveRecord} />
      </View>
    </SurfaceCard>
  );
}

function ScorePicker({ value, onChange }: { value: 1 | 2 | 3 | 4 | 5; onChange: (value: 1 | 2 | 3 | 4 | 5) => void }) {
  return (
    <View style={styles.scoreRow}>
      {[1, 2, 3, 4, 5].map((score) => (
        <Pressable key={score} style={[styles.scoreButton, value === score && styles.scoreButtonActive]} onPress={() => onChange(score as 1 | 2 | 3 | 4 | 5)}>
          <Text style={[styles.scoreText, value === score && styles.scoreTextActive]}>{score}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function formatCurrentTime() {
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...type.sectionTitle,
  },
  categoryRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  categoryButton: {
    flex: 1,
    minHeight: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  categoryButtonActive: {
    borderColor: colors.salmon,
    backgroundColor: colors.surfacePeach,
  },
  categoryLabel: {
    ...type.caption,
    color: colors.text,
    fontWeight: "600",
  },
  scoreRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  scoreButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
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
  memoInput: {
    ...type.body,
    minHeight: 86,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    padding: spacing.md,
    textAlignVertical: "top",
  },
});
