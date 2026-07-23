import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { QuickMedicationDoseInput } from "../application/medicationDoseRecords";
import type { DoseRecord, DoseStatus } from "../domain/medication";
import { NoticeBanner, PrimaryButton, SecondaryButton, SegmentedControl } from "../../../design-system/components";
import { colors, layout, radius, spacing, type } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";
import { TimePickerField } from "../../../design-system/TimePickerField";
import { createEmptyQuickMedicationState, createQuickMedicationEditState, doseStatusUpdateForEdit, isValidDoseTime, quickDoseSavedNoticeKey, shouldCloseMedicationEditAfterDelete } from "./careMedicationPanelState";

export type QuickMedicationSaveHandler = (input: QuickMedicationDoseInput) => void | Promise<void>;
export type QuickMedicationFormProps = {
  onSave: QuickMedicationSaveHandler;
  editingDose?: DoseRecord | null;
  onUpdate?: (input: QuickMedicationDoseInput & { id: string; scheduledTime?: string }) => void | Promise<void>;
  onDelete?: (dose: DoseRecord) => void | Promise<boolean | void>;
  onCancelEdit?: () => void;
  canDelete?: boolean;
};

export function QuickMedicationForm({ onSave, editingDose = null, onUpdate, onDelete, onCancelEdit, canDelete = true }: QuickMedicationFormProps) {
  const [conditionName, setConditionName] = useState("");
  const [medicationName, setMedicationName] = useState("");
  const [dosageLabel, setDosageLabel] = useState("");
  const [administeredAmount, setAdministeredAmount] = useState("");
  const [reactionNote, setReactionNote] = useState("");
  const [status, setStatus] = useState<DoseStatus>("completed");
  const [scheduledTime, setScheduledTime] = useState("");
  const [notice, setNotice] = useState<string>(t("ko", "care.quickDoseNotice"));
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const isEditing = Boolean(editingDose);

  useEffect(() => {
    if (!editingDose) {
      resetForm();
      setNotice(t("ko", "care.quickDoseNotice"));
      return;
    }

    const nextState = createQuickMedicationEditState(editingDose);
    setConditionName(nextState.conditionName);
    setMedicationName(nextState.medicationName);
    setDosageLabel(nextState.dosageLabel);
    setAdministeredAmount(nextState.administeredAmount);
    setReactionNote(nextState.reactionNote);
    setStatus(nextState.status);
    setScheduledTime(nextState.scheduledTime);
    setNotice(t("ko", "care.quickDoseEditingNotice"));
  }, [editingDose]);

  async function saveDose() {
    if (savingRef.current) {
      return;
    }

    if (!medicationName.trim()) {
      setNotice(t("ko", "care.quickDoseMedicationRequired"));
      return;
    }

    if (isEditing && !isValidDoseTime(scheduledTime)) {
      setNotice(t("ko", "care.quickDoseInvalidTime"));
      return;
    }

    savingRef.current = true;
    setIsSaving(true);

    try {
      if (editingDose && onUpdate) {
        await onUpdate({ id: editingDose.id, conditionName, medicationName, dosageLabel, administeredAmount, reactionNote, status: doseStatusUpdateForEdit(editingDose.status, status), scheduledTime });
        onCancelEdit?.();
      } else {
        await onSave({ conditionName, medicationName, dosageLabel, administeredAmount, reactionNote, status });
        resetForm();
      }
      setNotice(t("ko", quickDoseSavedNoticeKey(status)));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("ko", isEditing ? "care.quickDoseUpdateFailed" : "care.quickDoseNotice"));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  async function deleteDose() {
    if (!editingDose || !onDelete || savingRef.current) {
      return;
    }

    savingRef.current = true;
    setIsSaving(true);

    try {
      const deleted = await onDelete(editingDose);
      if (shouldCloseMedicationEditAfterDelete(deleted)) {
        onCancelEdit?.();
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("ko", "care.quickDoseDeleteFailed"));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  function resetForm() {
    const nextState = createEmptyQuickMedicationState();
    setConditionName(nextState.conditionName);
    setMedicationName(nextState.medicationName);
    setDosageLabel(nextState.dosageLabel);
    setAdministeredAmount(nextState.administeredAmount);
    setReactionNote(nextState.reactionNote);
    setStatus(nextState.status);
    setScheduledTime(nextState.scheduledTime);
  }

  return (
    <View style={styles.quickForm}>
      <Text style={styles.sectionTitle}>{t("ko", isEditing ? "care.quickDoseEditTitle" : "care.quickDoseTitle")}</Text>
      <NoticeBanner text={notice} icon="medication" />
      <TextInput accessibilityLabel={t("ko", "care.conditionPlaceholder")} style={styles.input} value={conditionName} onChangeText={(value) => setConditionName(value.slice(0, 80))} placeholder={t("ko", "care.conditionPlaceholder")} placeholderTextColor={colors.textSoft} />
      <TextInput accessibilityLabel={t("ko", "care.medicationPlaceholder")} style={styles.input} value={medicationName} onChangeText={(value) => setMedicationName(value.slice(0, 80))} placeholder={t("ko", "care.medicationPlaceholder")} placeholderTextColor={colors.textSoft} />
      {isEditing ? <TimePickerField accessibilityLabel={t("ko", "care.medicationTimeLabel")} value={scheduledTime} onChange={setScheduledTime} /> : null}
      <View style={styles.inputStack}>
        <TextInput accessibilityLabel={t("ko", "care.dosagePlaceholder")} style={styles.input} value={dosageLabel} onChangeText={(value) => setDosageLabel(value.slice(0, 80))} placeholder={t("ko", "care.dosagePlaceholder")} placeholderTextColor={colors.textSoft} />
        <TextInput accessibilityLabel={t("ko", "care.administeredPlaceholder")} style={styles.input} value={administeredAmount} onChangeText={(value) => setAdministeredAmount(value.slice(0, 80))} placeholder={t("ko", "care.administeredPlaceholder")} placeholderTextColor={colors.textSoft} />
      </View>
      <SegmentedControl
        value={status}
        onChange={setStatus}
        items={[
          { label: t("ko", "care.status.completedShort"), value: "completed" },
          { label: t("ko", "care.status.partialShort"), value: "partial" },
          { label: t("ko", "care.status.skippedShort"), value: "skipped" },
          { label: t("ko", "care.status.pendingShort"), value: "pending" },
        ]}
      />
      <TextInput
        accessibilityLabel={t("ko", "care.reactionPlaceholder")}
        multiline
        style={[styles.input, styles.noteInput]}
        value={reactionNote}
        onChangeText={(value) => setReactionNote(value.slice(0, 300))}
        placeholder={t("ko", "care.reactionPlaceholder")}
        placeholderTextColor={colors.textSoft}
      />
      <PrimaryButton label={t("ko", isEditing ? "care.quickDoseUpdate" : "care.quickDoseSave")} icon="medication" onPress={isSaving ? undefined : saveDose} disabled={isSaving} />
      {isEditing ? (
        <View style={styles.editActions}>
          <SecondaryButton label={t("ko", "care.quickDoseCancelEdit")} onPress={isSaving ? undefined : onCancelEdit} disabled={isSaving} />
          {canDelete ? (
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: isSaving }} disabled={isSaving} style={styles.dangerButton} onPress={deleteDose}>
              <Text style={styles.dangerButtonText}>{t("ko", "care.quickDoseDelete")}</Text>
            </Pressable>
          ) : <NoticeBanner text={t("ko", "permission.medicationDeleteOwnerOnly")} icon="shield" />}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { ...type.sectionTitle },
  quickForm: { gap: spacing.md },
  input: {
    ...type.body,
    minHeight: layout.inputHeight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputStack: { gap: spacing.sm },
  editActions: { gap: spacing.sm },
  dangerButton: { minHeight: layout.inputHeight, borderRadius: radius.md, borderWidth: 1, borderColor: colors.dangerBorder, alignItems: "center", justifyContent: "center" },
  dangerButtonText: { ...type.bodyStrong, color: colors.danger },
  noteInput: { minHeight: 78, textAlignVertical: "top" },
});
