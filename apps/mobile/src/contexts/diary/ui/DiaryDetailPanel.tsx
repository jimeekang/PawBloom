import { StyleSheet, Text, TextInput, View } from "react-native";
import type { DiaryCategory, DiaryDetailInput, MealSlot } from "../domain/diaryEntry";
import { FieldLabel, SegmentedControl, SurfaceCard } from "../../../design-system/components";
import { colors, layout, radius, spacing, type } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";

type Props = {
  category: DiaryCategory;
  detail: DiaryDetailInput;
  onChange: (detail: DiaryDetailInput) => void;
};

export function createDefaultDiaryDetail(category: DiaryCategory): DiaryDetailInput {
  if (category === "food") return { category, meals: {}, appetite: "normal" };
  if (category === "water") return { category, intakeLevel: "normal" };
  if (category === "walk") return { category, intensity: "normal" };
  if (category === "stool") return { category, consistency: "normal", hasBloodOrMucus: false };
  if (category === "condition") return { category, energyLevel: "normal" };
  return { category: "memo" };
}

export function DiaryDetailPanel({ category, detail, onChange }: Props) {
  if (category === "memo") return null;

  return (
    <SurfaceCard>
      <View style={styles.wrap}>
        <Text style={styles.sectionTitle}>{t("diary.detailTitle")}</Text>
        {detail.category === "food" ? <FoodDetail detail={detail} onChange={onChange} /> : null}
        {detail.category === "water" ? <WaterDetail detail={detail} onChange={onChange} /> : null}
        {detail.category === "walk" ? <WalkDetail detail={detail} onChange={onChange} /> : null}
        {detail.category === "stool" ? <StoolDetail detail={detail} onChange={onChange} /> : null}
        {detail.category === "condition" ? <ConditionDetail detail={detail} onChange={onChange} /> : null}
      </View>
    </SurfaceCard>
  );
}

function FoodDetail({ detail, onChange }: { detail: Extract<DiaryDetailInput, { category: "food" }>; onChange: Props["onChange"] }) {
  function updateMeal(slot: MealSlot, field: "offeredGrams" | "eatenGrams", value: string) {
    onChange({ ...detail, meals: { ...detail.meals, [slot]: { ...detail.meals[slot], [field]: grams(value) } } });
  }

  return (
    <>
      {mealSlots.map((slot) => (
        <View key={slot} style={styles.mealRow}>
          <Text style={styles.mealLabel}>{t(mealLabelKeys[slot])}</Text>
          <View style={styles.mealInputStack}>
            <FieldLabel label={t("diary.offeredGrams")} />
            <TextInput style={styles.compactInput} accessibilityLabel={`${t(mealLabelKeys[slot])}, ${t("diary.offeredGrams")}`} keyboardType="numeric" value={detail.meals[slot]?.offeredGrams ?? ""} onChangeText={(value) => updateMeal(slot, "offeredGrams", value)} placeholder={t("diary.offeredGrams")} placeholderTextColor={colors.textSoft} />
            <FieldLabel label={t("diary.eatenGrams")} />
            <TextInput style={styles.compactInput} accessibilityLabel={`${t(mealLabelKeys[slot])}, ${t("diary.eatenGrams")}`} keyboardType="numeric" value={detail.meals[slot]?.eatenGrams ?? ""} onChangeText={(value) => updateMeal(slot, "eatenGrams", value)} placeholder={t("diary.eatenGrams")} placeholderTextColor={colors.textSoft} />
          </View>
        </View>
      ))}
      <FieldLabel label={t("diary.appetiteLabel")} />
      <SegmentedControl
        value={detail.appetite ?? "normal"}
        onChange={(appetite) => onChange({ ...detail, appetite })}
        items={[
          { label: t("diary.appetite.good"), value: "good" },
          { label: t("diary.appetite.normal"), value: "normal" },
          { label: t("diary.appetite.low"), value: "low" },
          { label: t("diary.appetite.refused"), value: "refused" },
        ]}
      />
    </>
  );
}

function WaterDetail({ detail, onChange }: { detail: Extract<DiaryDetailInput, { category: "water" }>; onChange: Props["onChange"] }) {
  return (
    <>
      <FieldLabel label={t("diary.waterMl")} />
      <TextInput style={styles.input} accessibilityLabel={t("diary.waterMl")} keyboardType="numeric" value={detail.amountMl ?? ""} onChangeText={(value) => onChange({ ...detail, amountMl: milliliters(value) })} placeholder={t("diary.waterMl")} placeholderTextColor={colors.textSoft} />
      <FieldLabel label={t("diary.waterLevelLabel")} />
      <LevelControl value={detail.intakeLevel ?? "normal"} onChange={(intakeLevel) => onChange({ ...detail, intakeLevel })} />
    </>
  );
}

function WalkDetail({ detail, onChange }: { detail: Extract<DiaryDetailInput, { category: "walk" }>; onChange: Props["onChange"] }) {
  return (
    <>
      <FieldLabel label={t("diary.walkMinutes")} />
      <TextInput style={styles.input} accessibilityLabel={t("diary.walkMinutes")} keyboardType="numeric" value={detail.durationMinutes ?? ""} onChangeText={(value) => onChange({ ...detail, durationMinutes: minutes(value) })} placeholder={t("diary.walkMinutes")} placeholderTextColor={colors.textSoft} />
      <FieldLabel label={t("diary.walkIntensityLabel")} />
      <SegmentedControl value={detail.intensity ?? "normal"} onChange={(intensity) => onChange({ ...detail, intensity })} items={intensityItems()} />
      <FieldLabel label={t("diary.walkStoolObservation")} />
      <TextInput style={styles.input} accessibilityLabel={t("diary.walkStoolObservation")} value={detail.stoolObservation ?? ""} onChangeText={(value) => onChange({ ...detail, stoolObservation: value.slice(0, 80) })} placeholder={t("diary.walkStoolObservation")} placeholderTextColor={colors.textSoft} />
      <FieldLabel label={t("diary.walkUrineObservation")} />
      <TextInput style={styles.input} accessibilityLabel={t("diary.walkUrineObservation")} value={detail.urineObservation ?? ""} onChangeText={(value) => onChange({ ...detail, urineObservation: value.slice(0, 80) })} placeholder={t("diary.walkUrineObservation")} placeholderTextColor={colors.textSoft} />
      <FieldLabel label={t("diary.walkSymptomNote")} />
      <TextInput style={styles.input} accessibilityLabel={t("diary.walkSymptomNote")} value={detail.symptomNote ?? ""} onChangeText={(value) => onChange({ ...detail, symptomNote: value.slice(0, 160) })} placeholder={t("diary.walkSymptomNote")} placeholderTextColor={colors.textSoft} />
      <FieldLabel label={t("diary.walkObservation")} />
      <TextInput style={styles.input} accessibilityLabel={t("diary.walkObservation")} value={detail.observation ?? ""} onChangeText={(value) => onChange({ ...detail, observation: value.slice(0, 160) })} placeholder={t("diary.walkObservation")} placeholderTextColor={colors.textSoft} />
    </>
  );
}

function StoolDetail({ detail, onChange }: { detail: Extract<DiaryDetailInput, { category: "stool" }>; onChange: Props["onChange"] }) {
  return (
    <>
      <FieldLabel label={t("diary.stoolCount")} />
      <TextInput style={styles.input} accessibilityLabel={t("diary.stoolCount")} keyboardType="numeric" value={detail.count ?? ""} onChangeText={(value) => onChange({ ...detail, count: value.replace(/[^0-9]/g, "").slice(0, 2) })} placeholder={t("diary.stoolCount")} placeholderTextColor={colors.textSoft} />
      <FieldLabel label={t("diary.stoolConsistencyLabel")} />
      <SegmentedControl value={detail.consistency ?? "normal"} onChange={(consistency) => onChange({ ...detail, consistency })} items={stoolItems()} />
      <FieldLabel label={t("diary.bloodLabel")} />
      <SegmentedControl value={detail.hasBloodOrMucus ? "yes" : "no"} onChange={(value) => onChange({ ...detail, hasBloodOrMucus: value === "yes" })} items={bloodItems()} />
    </>
  );
}

function ConditionDetail({ detail, onChange }: { detail: Extract<DiaryDetailInput, { category: "condition" }>; onChange: Props["onChange"] }) {
  return (
    <>
      <FieldLabel label={t("care.energyLevel")} />
      <LevelControl value={detail.energyLevel ?? "normal"} onChange={(energyLevel) => onChange({ ...detail, energyLevel })} />
      <FieldLabel label={t("diary.discomfortNote")} />
      <TextInput style={styles.input} accessibilityLabel={t("diary.discomfortNote")} value={detail.discomfortNote ?? ""} onChangeText={(value) => onChange({ ...detail, discomfortNote: value.slice(0, 160) })} placeholder={t("diary.discomfortNote")} placeholderTextColor={colors.textSoft} />
    </>
  );
}

function LevelControl({ value, onChange }: { value: "less" | "normal" | "more"; onChange: (value: "less" | "normal" | "more") => void }) {
  return <SegmentedControl value={value} onChange={onChange} items={levelItems()} />;
}

const mealSlots: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
const mealLabelKeys = { breakfast: "diary.meal.breakfast", lunch: "diary.meal.lunch", dinner: "diary.meal.dinner", snack: "diary.meal.snack" } as const;
function levelItems(): { label: string; value: "less" | "normal" | "more" }[] { return [{ label: t("diary.level.less"), value: "less" }, { label: t("diary.level.normal"), value: "normal" }, { label: t("diary.level.more"), value: "more" }]; }
function intensityItems(): { label: string; value: "low" | "normal" | "high" }[] { return [{ label: t("diary.intensity.low"), value: "low" }, { label: t("diary.intensity.normal"), value: "normal" }, { label: t("diary.intensity.high"), value: "high" }]; }
function stoolItems(): { label: string; value: "normal" | "soft" | "diarrhea" | "hard" }[] { return [{ label: t("diary.stool.normal"), value: "normal" }, { label: t("diary.stool.soft"), value: "soft" }, { label: t("diary.stool.diarrhea"), value: "diarrhea" }, { label: t("diary.stool.hard"), value: "hard" }]; }
function bloodItems(): { label: string; value: "no" | "yes" }[] { return [{ label: t("diary.blood.no"), value: "no" }, { label: t("diary.blood.yes"), value: "yes" }]; }

function grams(value: string) {
  return value.replace(/[^0-9.]/g, "").slice(0, 5);
}

function milliliters(value: string) {
  return value.replace(/[^0-9]/g, "").slice(0, 5);
}

function minutes(value: string) {
  return value.replace(/[^0-9]/g, "").slice(0, 3);
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...type.sectionTitle,
  },
  mealRow: {
    gap: spacing.sm,
  },
  mealLabel: {
    ...type.bodyStrong,
  },
  mealInputStack: {
    gap: spacing.sm,
  },
  input: {
    ...type.body,
    minHeight: layout.inputHeight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  compactInput: {
    ...type.body,
    minHeight: layout.inputHeight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
});
