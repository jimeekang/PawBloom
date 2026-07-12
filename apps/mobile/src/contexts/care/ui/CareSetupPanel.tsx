import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ActiveCareSetup, CareMedicationSchedule, CareSetupInput } from "../domain/carePlan";
import { PrimaryButton, SegmentedControl, SurfaceCard } from "../../../design-system/components";
import { AppIcon } from "../../../design-system/iconography";
import { colors, font, iconSize, layout, radius, spacing, type } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";
import { DatePickerField } from "../../../design-system/DatePickerField";
import { TimePickerField } from "../../../design-system/TimePickerField";
import { buildCareSetupInput, careSetupDraftKey, createCareSetupFormDraft, isCareSetupDraftEmpty } from "./careSetupForm";
import { isCurrentCareSetupSave, nextCareSetupSaveScope, resolvePendingCareSetupMutation, type CareSetupSaveScope } from "./careSetupSaveGuard";
import { createUuid } from "../../../shared-kernel/uuid";

export function CareSetupPanel({ petId, setup, onSave, onUseSchedule }: { petId?: string; setup: ActiveCareSetup; onSave: (input: CareSetupInput) => Promise<ActiveCareSetup>; onUseSchedule: (schedule: CareMedicationSchedule) => void }) {
  const [draft, setDraft] = useState(() => createCareSetupFormDraft(setup, false));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const saveScopeRef = useRef<CareSetupSaveScope>({ petId: petId ?? null, generation: 0 });
  const pendingMutationRef = useRef<{ fingerprint: string; id: string } | null>(null);
  saveScopeRef.current = nextCareSetupSaveScope(saveScopeRef.current, petId);
  const setupKey = careSetupDraftKey(setup, petId);

  useEffect(() => {
    savingRef.current = false;
    setIsSaving(false);
    setDraft(createCareSetupFormDraft(setup, false));
    setError(null);
    pendingMutationRef.current = null;
  }, [setupKey]);

  const save = async () => {
    if (savingRef.current) return;
    if (isCareSetupDraftEmpty(draft)) {
      setError(t("ko", "care.setupRequired"));
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setError(null);
    const requestScope = saveScopeRef.current;
    const input = buildCareSetupInput(setup, draft, false);
    const pendingMutation = resolvePendingCareSetupMutation(pendingMutationRef.current, JSON.stringify(input), createUuid);
    pendingMutationRef.current = pendingMutation;
    try {
      const savedSetup = await onSave({ ...input, clientMutationId: pendingMutation.id });
      if (!isCurrentCareSetupSave(saveScopeRef.current, requestScope)) return;
      setDraft(createCareSetupFormDraft(savedSetup, false));
      pendingMutationRef.current = null;
    } catch (saveError) {
      if (!isCurrentCareSetupSave(saveScopeRef.current, requestScope)) return;
      setError(saveError instanceof Error ? saveError.message : t("ko", "care.setupSaveFailed"));
    } finally {
      if (isCurrentCareSetupSave(saveScopeRef.current, requestScope)) {
        savingRef.current = false;
        setIsSaving(false);
      }
    }
  };

  const updateConditionName = (value: string) => {
    setDraft((current) => ({ ...current, conditionName: value.slice(0, 80) }));
    if (value.trim() || draft.planTitle.trim() || draft.medicationName.trim()) setError(null);
  };

  const updatePlanTitle = (value: string) => {
    setDraft((current) => ({ ...current, planTitle: value.slice(0, 80) }));
    if (draft.conditionName.trim() || value.trim() || draft.medicationName.trim()) setError(null);
  };

  const updateMedicationName = (value: string) => {
    setDraft((current) => ({ ...current, medicationName: value.slice(0, 80) }));
    if (draft.conditionName.trim() || draft.planTitle.trim() || value.trim()) setError(null);
  };

  return (
    <SurfaceCard>
      <View style={styles.panel}>
        <Text style={styles.title}>{t("ko", "care.setupTitle")}</Text>
        <Text style={styles.copy}>{t("ko", "care.setupCopy")}</Text>
        {setup.condition || setup.plan ? (
          <View style={styles.activeBox}>
            <Text style={styles.activeTitle}>{setup.plan?.title ?? setup.condition?.name}</Text>
            <Text style={styles.activeMeta}>{setup.condition?.name ?? t("ko", "care.noConditionLinked")}</Text>
          </View>
        ) : null}
        <TextInput style={styles.input} value={draft.conditionName} onChangeText={updateConditionName} placeholder={t("ko", "care.conditionPlaceholder")} placeholderTextColor={colors.textSoft} />
        <TextInput style={styles.input} value={draft.planTitle} onChangeText={updatePlanTitle} placeholder={t("ko", "care.planPlaceholder")} placeholderTextColor={colors.textSoft} />
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.flex]} value={draft.medicationName} onChangeText={updateMedicationName} placeholder={t("ko", "care.medicationPlaceholder")} placeholderTextColor={colors.textSoft} />
          <TimePickerField value={draft.times[0] ?? "08:00"} onChange={(localTime) => setDraft((current) => ({ ...current, times: [localTime] }))} />
        </View>
        <TextInput style={styles.input} value={draft.dosageLabel} onChangeText={(value) => setDraft((current) => ({ ...current, dosageLabel: value.slice(0, 80) }))} placeholder={t("ko", "care.dosagePlaceholder")} placeholderTextColor={colors.textSoft} />
        <Text style={styles.label}>{t("ko", "care.setupPeriod")}</Text>
        <DatePickerField value={draft.startsOn} onChange={(startsOn) => setDraft((current) => ({ ...current, startsOn }))} placeholder={t("ko", "care.setupStartDate")} />
        <DatePickerField value={draft.endsOn} onChange={(endsOn) => setDraft((current) => ({ ...current, endsOn }))} placeholder={t("ko", "care.setupEndDate")} allowClear clearLabel={t("ko", "care.setupClearDate")} />
        <Text style={styles.label}>{t("ko", "care.setupRepeat")}</Text>
        <SegmentedControl value={draft.repeat} onChange={(repeat) => setDraft((current) => ({ ...current, repeat }))} items={[{ label: t("ko", "care.setupEveryDay"), value: "daily" }, { label: t("ko", "care.setupCustomRepeat"), value: "custom" }]} />
        {draft.repeat === "custom" ? (
          <View style={styles.repeatRow}>
            <TextInput style={[styles.input, styles.repeatInput]} value={draft.repeatDays} onChangeText={(value) => setDraft((current) => ({ ...current, repeatDays: value.replace(/[^0-9]/g, "").slice(0, 2) }))} keyboardType="number-pad" placeholder="2" placeholderTextColor={colors.textSoft} />
            <Text style={styles.repeatSuffix}>{t("ko", "care.setupCustomRepeatSuffix")}</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <PrimaryButton label={t("ko", "care.setupSave")} icon="medication" onPress={isSaving ? undefined : save} disabled={isSaving} />
        {setup.schedules.map((schedule) => (
          <Pressable key={schedule.id} style={styles.scheduleRow} onPress={() => onUseSchedule(schedule)}>
            <AppIcon name="medication" size={iconSize.md} color={colors.orangeDeep} />
            <View style={styles.flex}>
              <Text style={styles.scheduleTitle}>{schedule.medicationName}</Text>
              <Text style={styles.scheduleMeta}>{schedule.localTime.slice(0, 5)} · {schedule.dosageLabel}</Text>
            </View>
            <Text style={styles.useText}>{t("ko", "care.useToday")}</Text>
          </Pressable>
        ))}
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md },
  title: { ...type.sectionTitle },
  copy: { ...type.caption, color: colors.textMuted },
  label: { ...type.caption, color: colors.textMuted },
  activeBox: { gap: spacing.xxs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.summaryBorder, backgroundColor: colors.summaryBg, padding: spacing.md },
  activeTitle: { ...type.bodyStrong },
  activeMeta: { ...type.caption, color: colors.summaryAccent },
  row: { gap: spacing.sm },
  flex: { flex: 1 },
  input: { ...type.body, minHeight: layout.inputHeight, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  repeatRow: { gap: spacing.sm },
  repeatInput: { maxWidth: 96 },
  repeatSuffix: { ...type.caption, color: colors.textMuted },
  errorText: { ...type.caption, color: colors.coral },
  scheduleRow: { minHeight: 58, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  scheduleTitle: { ...type.bodyStrong },
  scheduleMeta: { ...type.caption, color: colors.textMuted },
  useText: { ...type.caption, color: colors.orangeDeep, fontWeight: font.weight.bold },
});
