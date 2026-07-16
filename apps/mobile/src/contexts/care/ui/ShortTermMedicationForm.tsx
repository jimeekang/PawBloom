import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ActiveCareSetup, CareSetupInput } from "../domain/carePlan";
import { PrimaryButton } from "../../../design-system/components";
import { colors, layout, radius, spacing, type } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";
import { DatePickerField } from "../../../design-system/DatePickerField";
import { TimePickerField } from "../../../design-system/TimePickerField";
import { getLocalDateKey } from "../../../shared-kernel/date";
import { buildShortTermCareSetupInput, createShortTermMedicationDraft, shortTermDraftErrorKey } from "./shortTermMedicationDraft";

export function ShortTermMedicationForm({ onSave, onSaved }: { onSave: (input: CareSetupInput) => Promise<ActiveCareSetup>; onSaved?: () => void }) {
  const [draft, setDraft] = useState(() => createShortTermMedicationDraft(getLocalDateKey()));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  async function save() {
    if (savingRef.current) return;
    const errorKey = shortTermDraftErrorKey(draft);
    if (errorKey) {
      setError(t("ko", errorKey));
      return;
    }
    savingRef.current = true;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(buildShortTermCareSetupInput(draft));
      setDraft(createShortTermMedicationDraft(getLocalDateKey()));
      onSaved?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("ko", "care.setupSaveFailed"));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{t("ko", "care.shortTermTitle")}</Text>
      <TextInput style={styles.input} value={draft.conditionName} onChangeText={(value) => setDraft((current) => ({ ...current, conditionName: value.slice(0, 80) }))} placeholder={t("ko", "care.conditionPlaceholder")} placeholderTextColor={colors.textSoft} />
      <TextInput style={styles.input} value={draft.medicationName} onChangeText={(value) => setDraft((current) => ({ ...current, medicationName: value.slice(0, 80) }))} placeholder={t("ko", "care.medicationPlaceholder")} placeholderTextColor={colors.textSoft} />
      <TextInput style={styles.input} value={draft.dosageLabel} onChangeText={(value) => setDraft((current) => ({ ...current, dosageLabel: value.slice(0, 80) }))} placeholder={t("ko", "care.dosagePlaceholder")} placeholderTextColor={colors.textSoft} />
      {draft.times.map((time, index) => (
        <View key={index} style={styles.timeRow}>
          <View style={styles.timeField}>
            <TimePickerField value={time} onChange={(nextTime) => setDraft((current) => ({ ...current, times: current.times.map((item, itemIndex) => (itemIndex === index ? nextTime : item)) }))} />
          </View>
          {draft.times.length > 1 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("ko", "care.removeTimeA11y")}
              style={styles.removeTimeButton}
              onPress={isSaving ? undefined : () => setDraft((current) => ({ ...current, times: current.times.filter((_, itemIndex) => itemIndex !== index) }))}
            >
              <Text style={styles.removeTimeText}>×</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: isSaving }} style={styles.addTimeButton} onPress={isSaving ? undefined : () => setDraft((current) => ({ ...current, times: [...current.times, "20:00"] }))}>
        <Text style={styles.addTimeText}>{t("ko", "pet.careDefaultsTimeAdd")}</Text>
      </Pressable>
      <Text style={styles.label}>{t("ko", "care.setupPeriod")}</Text>
      <DatePickerField value={draft.startsOn} onChange={(startsOn) => setDraft((current) => ({ ...current, startsOn }))} placeholder={t("ko", "care.setupStartDate")} />
      <DatePickerField value={draft.endsOn} onChange={(endsOn) => setDraft((current) => ({ ...current, endsOn }))} placeholder={t("ko", "care.shortTermEndDate")} />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <PrimaryButton label={t("ko", "care.shortTermSave")} icon="medication" onPress={isSaving ? undefined : () => void save()} disabled={isSaving} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md },
  title: { ...type.sectionTitle },
  label: { ...type.caption, color: colors.textMuted },
  input: { ...type.body, minHeight: layout.inputHeight, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  timeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  timeField: { flex: 1 },
  removeTimeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  removeTimeText: { ...type.sectionTitle, color: colors.textMuted },
  addTimeButton: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  addTimeText: { ...type.bodyStrong, color: colors.orangeDeep },
  errorText: { ...type.caption, color: colors.danger },
});
