import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { QuickMedicationDoseInput } from "../../contexts/medication/application/medicationDoseRecords";
import type { DoseRecord, DoseStatus } from "../../contexts/medication/domain/medication";
import { NoticeBanner, PrimaryButton, SegmentedControl, SurfaceCard } from "../../design-system/components";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize, radius, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";

export function QuickMedicationForm({ onSave }: { onSave: (input: QuickMedicationDoseInput) => void }) {
  const [conditionName, setConditionName] = useState("");
  const [medicationName, setMedicationName] = useState("");
  const [dosageLabel, setDosageLabel] = useState("");
  const [administeredAmount, setAdministeredAmount] = useState("");
  const [reactionNote, setReactionNote] = useState("");
  const [status, setStatus] = useState<DoseStatus>("completed");
  const [notice, setNotice] = useState(t("ko", "care.quickDoseNotice"));

  function saveDose() {
    if (!medicationName.trim()) {
      setNotice(t("ko", "care.quickDoseMedicationRequired"));
      return;
    }

    onSave({ conditionName, medicationName, dosageLabel, administeredAmount, reactionNote, status });
    setMedicationName("");
    setDosageLabel("");
    setAdministeredAmount("");
    setReactionNote("");
    setNotice(t("ko", "care.quickDoseSaved"));
  }

  return (
    <SurfaceCard>
      <View style={styles.quickForm}>
        <Text style={styles.sectionTitle}>{t("ko", "care.quickDoseTitle")}</Text>
        <NoticeBanner text={notice} icon="medication" />
        <TextInput style={styles.input} value={conditionName} onChangeText={(value) => setConditionName(value.slice(0, 80))} placeholder={t("ko", "care.conditionPlaceholder")} placeholderTextColor={colors.textSoft} />
        <TextInput style={styles.input} value={medicationName} onChangeText={(value) => setMedicationName(value.slice(0, 80))} placeholder={t("ko", "care.medicationPlaceholder")} placeholderTextColor={colors.textSoft} />
        <View style={styles.inputGrid}>
          <TextInput style={[styles.input, styles.inputHalf]} value={dosageLabel} onChangeText={(value) => setDosageLabel(value.slice(0, 80))} placeholder={t("ko", "care.dosagePlaceholder")} placeholderTextColor={colors.textSoft} />
          <TextInput style={[styles.input, styles.inputHalf]} value={administeredAmount} onChangeText={(value) => setAdministeredAmount(value.slice(0, 80))} placeholder={t("ko", "care.administeredPlaceholder")} placeholderTextColor={colors.textSoft} />
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
        <PrimaryButton label={t("ko", "care.quickDoseSave")} icon="medication" onPress={saveDose} />
      </View>
    </SurfaceCard>
  );
}

export function MedicationRow({ dose, onPress }: { dose: DoseRecord; onPress: () => void }) {
  const visual = statusVisual[dose.status];

  return (
    <Pressable style={styles.medRow} onPress={onPress}>
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
      <View style={[styles.doneCircle, dose.status === "completed" && styles.doneCircleActive]}>
        {dose.status === "completed" ? (
          <AppIcon name="check" size={iconSize.sm} color={colors.white} />
        ) : (
          <AppIcon name="circle" size={iconSize.sm} color={visual.icon} />
        )}
      </View>
    </Pressable>
  );
}

const statusVisual: Record<DoseStatus, { label: string; accent: string; icon: string }> = {
  pending: { label: t("ko", "care.status.pending"), accent: colors.salmon, icon: colors.salmon },
  completed: { label: t("ko", "care.status.completed"), accent: colors.mint, icon: colors.mintDeep },
  partial: { label: t("ko", "care.status.partial"), accent: colors.memo, icon: colors.orangeDeep },
  skipped: { label: t("ko", "care.status.skipped"), accent: colors.inactive, icon: colors.textSoft },
};

const styles = StyleSheet.create({
  sectionTitle: {
    ...type.sectionTitle,
  },
  quickForm: {
    gap: spacing.md,
  },
  input: {
    ...type.body,
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  inputHalf: {
    flex: 1,
  },
  noteInput: {
    minHeight: 78,
    textAlignVertical: "top",
  },
  medRow: {
    minHeight: 88,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: spacing.md,
    overflow: "hidden",
    gap: spacing.md,
  },
  medAccent: {
    width: 8,
    height: "100%",
  },
  medBody: {
    flex: 1,
    paddingVertical: spacing.sm,
  },
  medTitle: {
    ...type.bodyStrong,
  },
  medDetail: {
    ...type.caption,
  },
  medMeta: {
    ...type.tiny,
    color: colors.textMuted,
    marginTop: 2,
  },
  medTime: {
    ...type.body,
    color: colors.textMuted,
  },
  doneCircle: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.inactive,
    alignItems: "center",
    justifyContent: "center",
  },
  doneCircleActive: {
    backgroundColor: colors.mintDeep,
    borderColor: colors.mintDeep,
  },
});
