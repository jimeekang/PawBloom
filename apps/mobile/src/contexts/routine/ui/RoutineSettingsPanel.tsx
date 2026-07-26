import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { PetRoutine, PetRoutineInput, RoutineMealSlot } from "../domain/petRoutine";
import { FieldLabel, PrimaryButton, SegmentedControl, SurfaceCard } from "../../../design-system/components";
import { colors, font, layout, radius, spacing, type } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";
import { TimePickerField } from "../../../design-system/TimePickerField";
import { setMealRemindersEnabled, updateMealTime } from "./routineSettingsState";

export function RoutineSettingsPanel({ routine, onSave }: { routine: PetRoutine; onSave: (routine: PetRoutineInput) => void | Promise<void> }) {
  const [draft, setDraft] = useState<PetRoutine>(routine);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    setDraft(routine);
    setError(null);
  }, [routine]);

  const updateMeal = (slot: RoutineMealSlot, offeredGrams: string) => {
    setDraft((current) => ({ ...current, food: { ...current.food, meals: { ...current.food.meals, [slot]: { ...current.food.meals[slot], offeredGrams: offeredGrams.slice(0, 5) } } } }));
  };

  const save = async () => {
    if (savingRef.current) return;
    const { food, water, walk, stool, condition } = draft;
    savingRef.current = true;
    setIsSaving(true);
    setError(null);
    try {
      await onSave({ food, water, walk, stool, condition });
    } catch {
      setError(t("routine.saveFailed"));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <SurfaceCard>
      <View style={styles.panel}>
        <Text style={styles.title}>{t("routine.title")}</Text>
        <Text style={styles.copy}>{t("routine.copy")}</Text>
        <View style={styles.grid}>
          <View style={styles.gridCell}><FieldLabel label={t("routine.breakfast")} /><TextInput accessibilityLabel={t("routine.breakfast")} style={[styles.input, styles.cellInput]} value={draft.food.meals.breakfast?.offeredGrams ?? ""} onChangeText={(value) => updateMeal("breakfast", value)} placeholder={t("routine.breakfast")} placeholderTextColor={colors.textSoft} keyboardType="number-pad" /></View>
          <View style={styles.gridCell}><FieldLabel label={t("routine.lunch")} /><TextInput accessibilityLabel={t("routine.lunch")} style={[styles.input, styles.cellInput]} value={draft.food.meals.lunch?.offeredGrams ?? ""} onChangeText={(value) => updateMeal("lunch", value)} placeholder={t("routine.lunch")} placeholderTextColor={colors.textSoft} keyboardType="number-pad" /></View>
          <View style={styles.gridCell}><FieldLabel label={t("routine.dinner")} /><TextInput accessibilityLabel={t("routine.dinner")} style={[styles.input, styles.cellInput]} value={draft.food.meals.dinner?.offeredGrams ?? ""} onChangeText={(value) => updateMeal("dinner", value)} placeholder={t("routine.dinner")} placeholderTextColor={colors.textSoft} keyboardType="number-pad" /></View>
          <View style={styles.gridCell}><FieldLabel label={t("routine.water")} /><TextInput accessibilityLabel={t("routine.water")} style={[styles.input, styles.cellInput]} value={draft.water.amountMl ?? ""} onChangeText={(value) => setDraft((current) => ({ ...current, water: { ...current.water, amountMl: value.slice(0, 5) } }))} placeholder={t("routine.water")} placeholderTextColor={colors.textSoft} keyboardType="number-pad" /></View>
          <View style={styles.gridCell}><FieldLabel label={t("routine.stool")} /><TextInput accessibilityLabel={t("routine.stool")} style={[styles.input, styles.cellInput]} value={draft.stool.count ?? ""} onChangeText={(value) => setDraft((current) => ({ ...current, stool: { ...current.stool, count: value.slice(0, 3) } }))} placeholder={t("routine.stool")} placeholderTextColor={colors.textSoft} keyboardType="number-pad" /></View>
        </View>
        <Text style={styles.label}>{t("routine.mealRemindersLabel")}</Text>
        <SegmentedControl
          value={draft.food.mealRemindersEnabled === false ? "off" : "on"}
          onChange={(value) => setDraft((current) => setMealRemindersEnabled(current, value === "on"))}
          items={[{ label: t("routine.mealRemindersOn"), value: "on" }, { label: t("routine.mealRemindersOff"), value: "off" }]}
        />
        <Text style={styles.label}>{t("routine.mealTimesTitle")}</Text>
        <View style={styles.timeGrid}>
          {(["breakfast", "lunch", "dinner"] as const).map((slot) => (
            <View key={slot} style={styles.timeRow}>
              <Text style={styles.timeLabel}>{t(`routine.${slot}` as "routine.breakfast" | "routine.lunch" | "routine.dinner")}</Text>
              <TimePickerField accessibilityLabel={t(`routine.${slot}` as "routine.breakfast" | "routine.lunch" | "routine.dinner")} value={draft.food.meals[slot]?.localTime ?? ""} placeholder={t("routine.mealTimeUnset")} onChange={(value) => setDraft((current) => updateMealTime(current, slot, value))} />
              {draft.food.meals[slot]?.localTime ? <Pressable accessibilityRole="button" accessibilityLabel={t("routine.mealTimeClear")} style={styles.clearTimeButton} onPress={() => setDraft((current) => updateMealTime(current, slot, undefined))}><Text style={styles.clearTime}>{t("routine.mealTimeClear")}</Text></Pressable> : null}
            </View>
          ))}
        </View>
        <Text style={styles.label}>{t("routine.walkOptional")}</Text>
        <SegmentedControl
          value={draft.walk.enabled === false ? "off" : "on"}
          onChange={(value) => setDraft((current) => ({ ...current, walk: { ...current.walk, enabled: value === "on" } }))}
          items={[
            { label: t("routine.walkEnabled"), value: "on" },
            { label: t("routine.walkDisabled"), value: "off" },
          ]}
        />
        {draft.walk.enabled === false ? null : (
          <>
            <FieldLabel label={t("routine.walk")} />
            <TextInput accessibilityLabel={t("routine.walk")} style={styles.inputFull} value={draft.walk.durationMinutes ?? ""} onChangeText={(value) => setDraft((current) => ({ ...current, walk: { ...current.walk, durationMinutes: value.slice(0, 4) } }))} placeholder={t("routine.walk")} placeholderTextColor={colors.textSoft} keyboardType="number-pad" />
          </>
        )}
        <Text style={styles.label}>{t("care.energyLevel")}</Text>
        <SegmentedControl value={draft.condition.energyLevel ?? "normal"} onChange={(energyLevel) => setDraft((current) => ({ ...current, condition: { energyLevel } }))} items={[{ label: t("diary.level.less"), value: "less" }, { label: t("diary.level.normal"), value: "normal" }, { label: t("diary.level.more"), value: "more" }]} />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <PrimaryButton label={t("routine.save")} icon="check" onPress={save} disabled={isSaving} />
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.md,
  },
  title: {
    ...type.sectionTitle,
  },
  copy: {
    ...type.caption,
    color: colors.textMuted,
  },
  label: {
    ...type.caption,
    color: colors.text,
    fontWeight: font.weight.semibold,
  },
  errorText: {
    ...type.caption,
    color: colors.coral,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  timeGrid: {
    gap: spacing.sm,
  },
  timeRow: {
    gap: spacing.xs,
  },
  timeLabel: {
    ...type.caption,
    color: colors.text,
    fontWeight: font.weight.semibold,
  },
  clearTime: {
    ...type.tiny,
    color: colors.orangeDeep,
    fontWeight: font.weight.semibold,
  },
  clearTimeButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.xs },
  gridCell: {
    width: "48%",
    gap: spacing.xs,
  },
  cellInput: {
    width: "100%",
  },
  input: {
    ...type.body,
    width: "48%",
    minHeight: layout.inputHeight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  inputFull: {
    ...type.body,
    minHeight: layout.inputHeight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
});
