import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { QuickMedicationDoseInput } from "../application/medicationDoseRecords";
import type { DoseRecord, DoseStatus } from "../domain/medication";
import { NoticeBanner, PrimaryButton, SecondaryButton, SegmentedControl, SurfaceCard } from "../../../design-system/components";
import { AppIcon } from "../../../design-system/iconography";
import { colors, iconSize, layout, radius, spacing, type } from "../../../design-system/tokens";
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
    <SurfaceCard>
      <View style={styles.quickForm}>
        <Text style={styles.sectionTitle}>{t("ko", isEditing ? "care.quickDoseEditTitle" : "care.quickDoseTitle")}</Text>
        <NoticeBanner text={notice} icon="medication" />
        <TextInput style={styles.input} value={conditionName} onChangeText={(value) => setConditionName(value.slice(0, 80))} placeholder={t("ko", "care.conditionPlaceholder")} placeholderTextColor={colors.textSoft} />
        <TextInput style={styles.input} value={medicationName} onChangeText={(value) => setMedicationName(value.slice(0, 80))} placeholder={t("ko", "care.medicationPlaceholder")} placeholderTextColor={colors.textSoft} />
        {isEditing ? <TimePickerField value={scheduledTime} onChange={setScheduledTime} /> : null}
        <View style={styles.inputGrid}>
          <TextInput style={styles.input} value={dosageLabel} onChangeText={(value) => setDosageLabel(value.slice(0, 80))} placeholder={t("ko", "care.dosagePlaceholder")} placeholderTextColor={colors.textSoft} />
          <TextInput style={styles.input} value={administeredAmount} onChangeText={(value) => setAdministeredAmount(value.slice(0, 80))} placeholder={t("ko", "care.administeredPlaceholder")} placeholderTextColor={colors.textSoft} />
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
    </SurfaceCard>
  );
}

export function MedicationRow({ dose, onEdit, onStatusPress }: { dose: DoseRecord; onEdit: () => void; onStatusPress: () => void }) {
  const visual = statusVisual(dose.status);

  return (
    <View style={styles.medRow}>
      <Pressable style={styles.medEditTarget} onPress={onEdit}>
        <View style={[styles.medAccent, { backgroundColor: visual.accent }]} />
        <AppIcon name="medication" size={iconSize.lg} color={visual.icon} />
        <View style={styles.medBody}>
          <Text style={styles.medTitle}>{dose.medicationName}</Text>
          <Text style={styles.medDetail}>{visual.label}</Text>
          {dose.conditionName ? <Text style={styles.medMeta}>{t("ko", "care.conditionLabel")}: {dose.conditionName}</Text> : null}
          {dose.dosageLabel ? <Text style={styles.medMeta}>{t("ko", "care.dosageLabel")}: {dose.dosageLabel}</Text> : null}
          {dose.administeredAmount ? <Text style={styles.medMeta}>{t("ko", "care.administeredLabel")}: {dose.administeredAmount}</Text> : null}
          {dose.reactionNote ? <Text style={styles.medMeta}>{t("ko", "care.reactionLabel")}: {dose.reactionNote}</Text> : null}
        </View>
        <Text style={styles.medTime}>{dose.scheduledAt}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: dose.status === "completed" }}
        accessibilityLabel={`${dose.medicationName} · ${visual.label}`}
        hitSlop={10}
        style={[styles.doneCircle, dose.status === "completed" && styles.doneCircleActive]}
        onPress={onStatusPress}
      >
        {dose.status === "completed" ? (
          <AppIcon name="check" size={iconSize.sm} color={colors.white} />
        ) : (
          <AppIcon name="circle" size={iconSize.sm} color={visual.icon} />
        )}
      </Pressable>
    </View>
  );
}

function statusVisual(status: DoseStatus): { label: string; accent: string; icon: string } {
  if (status === "pending") return { label: t("ko", "care.status.pending"), accent: colors.salmon, icon: colors.salmon };
  if (status === "completed") return { label: t("ko", "care.status.completed"), accent: colors.mint, icon: colors.mintDeep };
  if (status === "partial") return { label: t("ko", "care.status.partial"), accent: colors.memo, icon: colors.orangeDeep };
  return { label: t("ko", "care.status.skipped"), accent: colors.inactive, icon: colors.textSoft };
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
  inputGrid: { gap: spacing.sm },
  editActions: { gap: spacing.sm },
  dangerButton: { minHeight: layout.inputHeight, borderRadius: radius.md, borderWidth: 1, borderColor: colors.dangerBorder, alignItems: "center", justifyContent: "center" },
  dangerButtonText: { ...type.bodyStrong, color: colors.danger },
  noteInput: { minHeight: 78, textAlignVertical: "top" },
  medRow: {
    minHeight: 88,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    gap: spacing.md,
  },
  medEditTarget: { flex: 1, minHeight: 88, flexDirection: "row", alignItems: "center", gap: spacing.md },
  medAccent: { width: 8, height: "100%" },
  medBody: { flex: 1, paddingVertical: spacing.sm },
  medTitle: { ...type.bodyStrong },
  medDetail: { ...type.caption },
  medMeta: { ...type.tiny, color: colors.textMuted, marginTop: 2 },
  medTime: { ...type.body, color: colors.textMuted },
  doneCircle: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.inactive,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  doneCircleActive: { backgroundColor: colors.mintDeep, borderColor: colors.mintDeep },
});
