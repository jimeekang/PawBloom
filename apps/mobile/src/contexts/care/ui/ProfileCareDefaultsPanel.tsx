import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ActiveCareSetup, CareSetupInput } from "../domain/carePlan";
import { FieldLabel, PrimaryButton, SegmentedControl, SurfaceCard } from "../../../design-system/components";
import { colors, layout, radius, spacing, type } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";
import { errorNoticeText } from "../../../i18n/errorNotice";
import { DatePickerField } from "../../../design-system/DatePickerField";
import { TimePickerField } from "../../../design-system/TimePickerField";
import {
  buildCareSetupInput,
  careSetupDraftKey,
  createCareSetupFormDraft,
  getCareMedicationGroups,
  getInitialCareMedicationSelection,
  isCareSetupDraftEmpty,
  isCareSetupMedicationMissingDosage,
  isCareSetupPeriodInvalid,
  resolveCareMedicationSelection,
  type CareMedicationSelection,
} from "./careSetupForm";
import { isCurrentCareSetupSave, nextCareSetupSaveScope, resolvePendingCareSetupMutation, type CareSetupSaveScope } from "./careSetupSaveGuard";
import { createUuid } from "../../../shared-kernel/uuid";

export function ProfileCareDefaultsPanel({ petId, setup, onSave, medicationRemindersEnabled, onToggleMedicationReminders }: { petId?: string; setup: ActiveCareSetup; onSave: (input: CareSetupInput) => Promise<ActiveCareSetup>; medicationRemindersEnabled?: boolean; onToggleMedicationReminders?: (enabled: boolean) => void }) {
  const [selectedMedicationId, setSelectedMedicationId] = useState<CareMedicationSelection>(() => getInitialCareMedicationSelection(setup));
  const [draft, setDraft] = useState(() => createCareSetupFormDraft(setup, true, getInitialCareMedicationSelection(setup)));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const saveScopeRef = useRef<CareSetupSaveScope>({ petId: petId ?? null, generation: 0 });
  const pendingMutationRef = useRef<{ fingerprint: string; id: string } | null>(null);
  saveScopeRef.current = nextCareSetupSaveScope(saveScopeRef.current, petId);
  const setupKey = careSetupDraftKey(setup, petId);
  const medicationGroups = getCareMedicationGroups(setup);

  useEffect(() => {
    const nextSelection = resolveCareMedicationSelection(setup, selectedMedicationId);
    savingRef.current = false;
    setIsSaving(false);
    setSelectedMedicationId(nextSelection);
    setDraft(createCareSetupFormDraft(setup, true, nextSelection));
    setError(null);
    pendingMutationRef.current = null;
  }, [setupKey]);

  function selectMedication(selection: CareMedicationSelection) {
    if (savingRef.current) return;
    setSelectedMedicationId(selection);
    setDraft(createCareSetupFormDraft(setup, true, selection));
    setError(null);
    pendingMutationRef.current = null;
  }

  async function save() {
    if (savingRef.current) return;
    if (isCareSetupDraftEmpty(draft)) {
      setError(t("care.setupRequired"));
      return;
    }
    if (isCareSetupPeriodInvalid(draft)) {
      setError(t("care.shortTermPeriodInvalid"));
      return;
    }
    if (isCareSetupMedicationMissingDosage(draft)) {
      setError(t("care.dosageRequired"));
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setError(null);
    const requestScope = saveScopeRef.current;
    const requestSelection = selectedMedicationId;
    const input = buildCareSetupInput(setup, draft, true, requestSelection);
    const pendingMutation = resolvePendingCareSetupMutation(pendingMutationRef.current, JSON.stringify(input), createUuid);
    pendingMutationRef.current = pendingMutation;
    try {
      const savedSetup = await onSave({ ...input, clientMutationId: pendingMutation.id });
      if (!isCurrentCareSetupSave(saveScopeRef.current, requestScope)) return;
      setDraft(createCareSetupFormDraft(savedSetup, true, requestSelection));
      pendingMutationRef.current = null;
    } catch (saveError) {
      if (!isCurrentCareSetupSave(saveScopeRef.current, requestScope)) return;
      setError(errorNoticeText(saveError, "care.setupSaveFailed"));
    } finally {
      if (isCurrentCareSetupSave(saveScopeRef.current, requestScope)) {
        savingRef.current = false;
        setIsSaving(false);
      }
    }
  }

  return (
    <SurfaceCard>
      <View style={styles.panel}>
        <Text style={styles.title}>{t("pet.careDefaultsTitle")}</Text>
        <Text style={styles.copy}>{t("pet.careDefaultsCopy")}</Text>
        {onToggleMedicationReminders ? (
          <View>
            <FieldLabel label={t("care.medicationRemindersLabel")} />
            <SegmentedControl
              value={medicationRemindersEnabled === false ? "off" : "on"}
              onChange={(value) => onToggleMedicationReminders(value === "on")}
              items={[
                { label: t("routine.mealRemindersOn"), value: "on" },
                { label: t("routine.mealRemindersOff"), value: "off" },
              ]}
            />
          </View>
        ) : null}
        {setup.conditions.map((condition) => (
          <Text key={condition.id} style={styles.savedText}>{condition.name}</Text>
        ))}
        {setup.schedules.map((schedule) => (
          <Text key={schedule.id} style={styles.savedText}>{schedule.localTime.slice(0, 5)} · {schedule.medicationName} · {schedule.dosageLabel}</Text>
        ))}
        {medicationGroups.length > 0 ? (
          <View style={styles.medicationSelector}>
            {medicationGroups.map((group) => {
              const selected = selectedMedicationId === group.medicationId;
              return (
                <Pressable
                  key={group.medicationId}
                  accessibilityRole="radio"
                  accessibilityLabel={group.medicationName}
                  accessibilityState={{ checked: selected, disabled: isSaving }}
                  aria-checked={selected}
                  style={[styles.medicationOption, selected ? styles.medicationOptionSelected : null]}
                  onPress={isSaving ? undefined : () => selectMedication(group.medicationId)}
                >
                  <Text style={[styles.medicationOptionTitle, selected ? styles.medicationOptionTitleSelected : null]}>{group.medicationName}</Text>
                  <Text style={styles.medicationOptionMeta}>{group.schedules.map((schedule) => schedule.localTime.slice(0, 5)).join(" · ")}</Text>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel={t("care.addNewMedicationOption")}
              accessibilityState={{ checked: selectedMedicationId === null, disabled: isSaving }}
              aria-checked={selectedMedicationId === null}
              style={[styles.medicationOption, selectedMedicationId === null ? styles.medicationOptionSelected : null]}
              onPress={isSaving ? undefined : () => selectMedication(null)}
            >
              <Text style={[styles.medicationOptionTitle, selectedMedicationId === null ? styles.medicationOptionTitleSelected : null]}>+ {t("care.addNewMedicationOption")}</Text>
            </Pressable>
          </View>
        ) : null}
        <FieldLabel label={t("care.conditionPlaceholder")} />
        <TextInput accessibilityLabel={t("care.conditionPlaceholder")} style={styles.input} value={draft.conditionName} onChangeText={(value) => setDraft((current) => ({ ...current, conditionName: value.slice(0, 80) }))} placeholder={t("care.conditionPlaceholder")} placeholderTextColor={colors.textSoft} />
        <FieldLabel label={t("care.planPlaceholder")} />
        <TextInput accessibilityLabel={t("care.planPlaceholder")} style={styles.input} value={draft.planTitle} onChangeText={(value) => setDraft((current) => ({ ...current, planTitle: value.slice(0, 80) }))} placeholder={t("care.planPlaceholder")} placeholderTextColor={colors.textSoft} />
        <FieldLabel label={t("care.medicationPlaceholder")} />
        <TextInput accessibilityLabel={t("care.medicationPlaceholder")} style={styles.input} value={draft.medicationName} onChangeText={(value) => setDraft((current) => ({ ...current, medicationName: value.slice(0, 80) }))} placeholder={t("care.medicationPlaceholder")} placeholderTextColor={colors.textSoft} />
        <FieldLabel label={t("care.dosagePlaceholder")} />
        <TextInput accessibilityLabel={t("care.dosagePlaceholder")} style={styles.input} value={draft.dosageLabel} onChangeText={(value) => setDraft((current) => ({ ...current, dosageLabel: value.slice(0, 80) }))} placeholder={t("care.dosagePlaceholder")} placeholderTextColor={colors.textSoft} />
        <Text style={styles.label}>{t("pet.careDefaultsPeriod")}</Text>
        <DatePickerField value={draft.startsOn} onChange={(startsOn) => setDraft((current) => ({ ...current, startsOn }))} placeholder={t("pet.careDefaultsStartDate")} />
        <DatePickerField value={draft.endsOn} onChange={(endsOn) => setDraft((current) => ({ ...current, endsOn }))} placeholder={t("pet.careDefaultsEndDate")} allowClear clearLabel={t("pet.careDefaultsClearDate")} />
        <Text style={styles.label}>{t("pet.careDefaultsRepeat")}</Text>
        <SegmentedControl value={draft.repeat} onChange={(repeat) => setDraft((current) => ({ ...current, repeat }))} items={[{ label: t("pet.careDefaultsEveryDay"), value: "daily" }, { label: t("pet.careDefaultsCustomRepeat"), value: "custom" }]} />
        {draft.repeat === "custom" ? (
          <View style={styles.repeatRow}>
            <TextInput accessibilityLabel={t("pet.careDefaultsCustomRepeat")} style={[styles.input, styles.repeatInput]} value={draft.repeatDays} onChangeText={(value) => setDraft((current) => ({ ...current, repeatDays: value.replace(/[^0-9]/g, "").slice(0, 3) }))} keyboardType="number-pad" placeholder="2" placeholderTextColor={colors.textSoft} />
            <Text style={styles.repeatSuffix}>{t("pet.careDefaultsCustomRepeatSuffix")}</Text>
          </View>
        ) : null}
        {draft.times.map((time, index) => (
          <View key={index} style={styles.timeRow}>
            <View style={styles.timeField}>
              <TimePickerField accessibilityLabel={`${t("care.medicationTimeLabel")} ${index + 1}`} value={time} onChange={(nextTime) => setDraft((current) => ({ ...current, times: current.times.map((item, itemIndex) => (itemIndex === index ? nextTime : item)) }))} />
            </View>
            {draft.times.length > 1 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("care.removeTimeA11y")}
                style={styles.removeTimeButton}
                onPress={isSaving ? undefined : () => setDraft((current) => ({ ...current, times: current.times.filter((_, itemIndex) => itemIndex !== index) }))}
              >
                <Text style={styles.removeTimeText}>×</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isSaving }}
          style={styles.addTimeButton}
          onPress={isSaving ? undefined : () => setDraft((current) => ({ ...current, times: [...current.times, "20:00"] }))}
        >
          <Text style={styles.addTimeText}>{t("pet.careDefaultsTimeAdd")}</Text>
        </Pressable>
        <Text style={styles.copy}>{t("pet.careDefaultsSavedHint")}</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <PrimaryButton label={t("care.setupSave")} icon="medication" onPress={isSaving ? undefined : save} disabled={isSaving} />
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md },
  title: { ...type.sectionTitle },
  copy: { ...type.caption, color: colors.textMuted },
  label: { ...type.caption, color: colors.text },
  savedText: { ...type.caption, color: colors.textMuted },
  medicationSelector: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  medicationOption: { minWidth: 112, minHeight: 44, justifyContent: "center", gap: spacing.xxs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  medicationOptionSelected: { borderColor: colors.orangeDeep, backgroundColor: colors.surfacePeach },
  medicationOptionTitle: { ...type.bodyStrong, color: colors.text },
  medicationOptionTitleSelected: { color: colors.orangeDeep },
  medicationOptionMeta: { ...type.caption, color: colors.textMuted },
  input: { ...type.body, minHeight: layout.inputHeight, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  repeatRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  repeatInput: { width: 96, flex: 0 },
  repeatSuffix: { ...type.body, color: colors.textMuted, flex: 1 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  timeField: { flex: 1 },
  removeTimeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  removeTimeText: { ...type.sectionTitle, color: colors.textMuted },
  addTimeButton: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  addTimeText: { ...type.bodyStrong, color: colors.orangeDeep },
  errorText: { ...type.caption, color: colors.danger },
});
