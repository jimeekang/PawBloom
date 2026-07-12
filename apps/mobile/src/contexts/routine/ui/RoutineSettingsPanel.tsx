import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { PetRoutine, PetRoutineInput, RoutineMealSlot } from "../domain/petRoutine";
import { PrimaryButton, SegmentedControl, SurfaceCard } from "../../../design-system/components";
import { colors, radius, spacing, type } from "../../../design-system/tokens";
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
      setError(t("ko", "routine.saveFailed"));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <SurfaceCard>
      <View style={styles.panel}>
        <Text style={styles.title}>{t("ko", "routine.title")}</Text>
        <Text style={styles.copy}>{t("ko", "routine.copy")}</Text>
        <View style={styles.grid}>
          <TextInput style={styles.input} value={draft.food.meals.breakfast?.offeredGrams ?? ""} onChangeText={(value) => updateMeal("breakfast", value)} placeholder={t("ko", "routine.breakfast")} placeholderTextColor={colors.textSoft} keyboardType="number-pad" />
          <TextInput style={styles.input} value={draft.food.meals.lunch?.offeredGrams ?? ""} onChangeText={(value) => updateMeal("lunch", value)} placeholder={t("ko", "routine.lunch")} placeholderTextColor={colors.textSoft} keyboardType="number-pad" />
          <TextInput style={styles.input} value={draft.food.meals.dinner?.offeredGrams ?? ""} onChangeText={(value) => updateMeal("dinner", value)} placeholder={t("ko", "routine.dinner")} placeholderTextColor={colors.textSoft} keyboardType="number-pad" />
          <TextInput style={styles.input} value={draft.water.amountMl ?? ""} onChangeText={(value) => setDraft((current) => ({ ...current, water: { ...current.water, amountMl: value.slice(0, 5) } }))} placeholder={t("ko", "routine.water")} placeholderTextColor={colors.textSoft} keyboardType="number-pad" />
          <TextInput style={styles.input} value={draft.stool.count ?? ""} onChangeText={(value) => setDraft((current) => ({ ...current, stool: { ...current.stool, count: value.slice(0, 3) } }))} placeholder={t("ko", "routine.stool")} placeholderTextColor={colors.textSoft} keyboardType="number-pad" />
        </View>
        <Text style={styles.label}>{t("ko", "routine.mealTimesTitle")}</Text>
        <SegmentedControl
          value={draft.food.mealRemindersEnabled === false ? "off" : "on"}
          onChange={(value) => setDraft((current) => setMealRemindersEnabled(current, value === "on"))}
          items={[{ label: t("ko", "routine.mealRemindersOn"), value: "on" }, { label: t("ko", "routine.mealRemindersOff"), value: "off" }]}
        />
        <View style={styles.timeGrid}>
          {(["breakfast", "lunch", "dinner"] as const).map((slot) => (
            <View key={slot} style={styles.timeRow}>
              <Text style={styles.timeLabel}>{t("ko", `routine.${slot}` as "routine.breakfast" | "routine.lunch" | "routine.dinner")}</Text>
              <TimePickerField value={draft.food.meals[slot]?.localTime ?? ""} placeholder={t("ko", "routine.mealTimeUnset")} onChange={(value) => setDraft((current) => updateMealTime(current, slot, value))} />
              {draft.food.meals[slot]?.localTime ? <Pressable accessibilityRole="button" accessibilityLabel={t("ko", "routine.mealTimeClear")} onPress={() => setDraft((current) => updateMealTime(current, slot, undefined))}><Text style={styles.clearTime}>{t("ko", "routine.mealTimeClear")}</Text></Pressable> : null}
            </View>
          ))}
        </View>
        <Text style={styles.label}>{t("ko", "routine.walkOptional")}</Text>
        <SegmentedControl
          value={draft.walk.enabled === false ? "off" : "on"}
          onChange={(value) => setDraft((current) => ({ ...current, walk: { ...current.walk, enabled: value === "on" } }))}
          items={[
            { label: t("ko", "routine.walkEnabled"), value: "on" },
            { label: t("ko", "routine.walkDisabled"), value: "off" },
          ]}
        />
        {draft.walk.enabled === false ? null : (
          <TextInput style={styles.inputFull} value={draft.walk.durationMinutes ?? ""} onChangeText={(value) => setDraft((current) => ({ ...current, walk: { ...current.walk, durationMinutes: value.slice(0, 4) } }))} placeholder={t("ko", "routine.walk")} placeholderTextColor={colors.textSoft} keyboardType="number-pad" />
        )}
        <SegmentedControl value={draft.condition.energyLevel ?? "normal"} onChange={(energyLevel) => setDraft((current) => ({ ...current, condition: { energyLevel } }))} items={[{ label: t("ko", "diary.level.less"), value: "less" }, { label: t("ko", "diary.level.normal"), value: "normal" }, { label: t("ko", "diary.level.more"), value: "more" }]} />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <PrimaryButton label={t("ko", "routine.save")} icon="check" onPress={save} disabled={isSaving} />
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
    fontWeight: "600",
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
    fontWeight: "600",
  },
  clearTime: {
    ...type.tiny,
    color: colors.orangeDeep,
    fontWeight: "600",
  },
  input: {
    ...type.body,
    width: "48%",
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  inputFull: {
    ...type.body,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
});
