import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ActiveCareSetup, CareMedicationSchedule, CareSetupInput } from "../../contexts/care/domain/carePlan";
import { PrimaryButton, SurfaceCard } from "../../design-system/components";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize, radius, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";

export function CareSetupPanel({ setup, onSave, onUseSchedule }: { setup: ActiveCareSetup; onSave: (input: CareSetupInput) => void; onUseSchedule: (schedule: CareMedicationSchedule) => void }) {
  const [conditionName, setConditionName] = useState(setup.conditionName ?? "");
  const [planTitle, setPlanTitle] = useState(setup.planTitle ?? "");
  const [medicationName, setMedicationName] = useState("");
  const [dosageLabel, setDosageLabel] = useState("");
  const [localTime, setLocalTime] = useState("08:00");

  const save = () => {
    onSave({ conditionName, planTitle, medicationName, dosageLabel, localTime });
    setMedicationName("");
    setDosageLabel("");
  };

  return (
    <SurfaceCard>
      <View style={styles.panel}>
        <Text style={styles.title}>{t("ko", "care.setupTitle")}</Text>
        <Text style={styles.copy}>{t("ko", "care.setupCopy")}</Text>
        <TextInput style={styles.input} value={conditionName} onChangeText={(value) => setConditionName(value.slice(0, 80))} placeholder={t("ko", "care.conditionPlaceholder")} placeholderTextColor={colors.textSoft} />
        <TextInput style={styles.input} value={planTitle} onChangeText={(value) => setPlanTitle(value.slice(0, 80))} placeholder={t("ko", "care.planPlaceholder")} placeholderTextColor={colors.textSoft} />
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.flex]} value={medicationName} onChangeText={(value) => setMedicationName(value.slice(0, 80))} placeholder={t("ko", "care.medicationPlaceholder")} placeholderTextColor={colors.textSoft} />
          <TextInput style={styles.timeInput} value={localTime} onChangeText={(value) => setLocalTime(value.slice(0, 5))} placeholder="08:00" placeholderTextColor={colors.textSoft} />
        </View>
        <TextInput style={styles.input} value={dosageLabel} onChangeText={(value) => setDosageLabel(value.slice(0, 80))} placeholder={t("ko", "care.dosagePlaceholder")} placeholderTextColor={colors.textSoft} />
        <PrimaryButton label={t("ko", "care.setupSave")} icon="medication" onPress={save} />
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
  row: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1 },
  input: { ...type.body, minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  timeInput: { ...type.body, width: 78, minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, paddingHorizontal: spacing.sm },
  scheduleRow: { minHeight: 58, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  scheduleTitle: { ...type.bodyStrong },
  scheduleMeta: { ...type.caption, color: colors.textMuted },
  useText: { ...type.caption, color: colors.orangeDeep, fontWeight: "700" },
});
