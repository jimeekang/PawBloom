import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ActiveCareSetup, CareMedicationSchedule, CareSetupInput } from "../domain/carePlan";
import { PrimaryButton, SegmentedControl, SurfaceCard } from "../../../design-system/components";
import { AppIcon } from "../../../design-system/iconography";
import { colors, iconSize, radius, spacing, type } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";
import { DatePickerField } from "../../../design-system/DatePickerField";
import { TimePickerField } from "../../../design-system/TimePickerField";

type RepeatOption = "daily" | "custom";

export function CareSetupPanel({ setup, onSave, onUseSchedule }: { setup: ActiveCareSetup; onSave: (input: CareSetupInput) => void; onUseSchedule: (schedule: CareMedicationSchedule) => void }) {
  const [conditionName, setConditionName] = useState(setup.conditionName ?? "");
  const [planTitle, setPlanTitle] = useState(setup.planTitle ?? "");
  const [medicationName, setMedicationName] = useState("");
  const [dosageLabel, setDosageLabel] = useState("");
  const [localTime, setLocalTime] = useState("08:00");
  const [startsOn, setStartsOn] = useState(setup.schedules[0]?.startsOn ?? getLocalDateKey());
  const [endsOn, setEndsOn] = useState(setup.schedules[0]?.endsOn ?? "");
  const [repeat, setRepeat] = useState<RepeatOption>(setup.schedules[0]?.recurrenceIntervalDays && setup.schedules[0].recurrenceIntervalDays > 1 ? "custom" : "daily");
  const [repeatInterval, setRepeatInterval] = useState(String(setup.schedules[0]?.recurrenceIntervalDays && setup.schedules[0].recurrenceIntervalDays > 1 ? setup.schedules[0].recurrenceIntervalDays : 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConditionName(setup.conditionName ?? "");
    setPlanTitle(setup.planTitle ?? "");
    setStartsOn(setup.schedules[0]?.startsOn ?? getLocalDateKey());
    setEndsOn(setup.schedules[0]?.endsOn ?? "");
    setRepeat(setup.schedules[0]?.recurrenceIntervalDays && setup.schedules[0].recurrenceIntervalDays > 1 ? "custom" : "daily");
    setRepeatInterval(String(setup.schedules[0]?.recurrenceIntervalDays && setup.schedules[0].recurrenceIntervalDays > 1 ? setup.schedules[0].recurrenceIntervalDays : 2));
    setError(null);
  }, [setup.conditionName, setup.planTitle, setup.schedules]);

  const save = () => {
    const nextConditionName = conditionName.trim();
    const nextPlanTitle = planTitle.trim();
    const nextMedicationName = medicationName.trim();

    if (!nextConditionName && !nextPlanTitle && !nextMedicationName) {
      setError(t("ko", "care.setupRequired"));
      return;
    }

    onSave({
      conditionName: nextConditionName,
      planTitle: nextPlanTitle,
      medicationName: nextMedicationName,
      dosageLabel: dosageLabel.trim(),
      localTime: localTime.trim(),
      startsOn,
      endsOn,
      recurrenceIntervalDays: repeat === "daily" ? 1 : Number(repeatInterval) || 1,
    });
    setError(null);
    setMedicationName("");
    setDosageLabel("");
  };

  const updateConditionName = (value: string) => {
    setConditionName(value.slice(0, 80));
    if (value.trim() || planTitle.trim() || medicationName.trim()) setError(null);
  };

  const updatePlanTitle = (value: string) => {
    setPlanTitle(value.slice(0, 80));
    if (conditionName.trim() || value.trim() || medicationName.trim()) setError(null);
  };

  const updateMedicationName = (value: string) => {
    setMedicationName(value.slice(0, 80));
    if (conditionName.trim() || planTitle.trim() || value.trim()) setError(null);
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
        <TextInput style={styles.input} value={conditionName} onChangeText={updateConditionName} placeholder={t("ko", "care.conditionPlaceholder")} placeholderTextColor={colors.textSoft} />
        <TextInput style={styles.input} value={planTitle} onChangeText={updatePlanTitle} placeholder={t("ko", "care.planPlaceholder")} placeholderTextColor={colors.textSoft} />
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.flex]} value={medicationName} onChangeText={updateMedicationName} placeholder={t("ko", "care.medicationPlaceholder")} placeholderTextColor={colors.textSoft} />
          <View style={styles.timePicker}>
            <TimePickerField value={localTime} onChange={setLocalTime} />
          </View>
        </View>
        <TextInput style={styles.input} value={dosageLabel} onChangeText={(value) => setDosageLabel(value.slice(0, 80))} placeholder={t("ko", "care.dosagePlaceholder")} placeholderTextColor={colors.textSoft} />
        <Text style={styles.label}>{t("ko", "care.setupPeriod")}</Text>
        <DatePickerField value={startsOn} onChange={setStartsOn} placeholder={t("ko", "care.setupStartDate")} />
        <DatePickerField value={endsOn} onChange={setEndsOn} placeholder={t("ko", "care.setupEndDate")} allowClear clearLabel={t("ko", "care.setupClearDate")} />
        <Text style={styles.label}>{t("ko", "care.setupRepeat")}</Text>
        <SegmentedControl value={repeat} onChange={setRepeat} items={[{ label: t("ko", "care.setupEveryDay"), value: "daily" }, { label: t("ko", "care.setupCustomRepeat"), value: "custom" }]} />
        {repeat === "custom" ? (
          <View style={styles.repeatRow}>
            <TextInput style={[styles.input, styles.repeatInput]} value={repeatInterval} onChangeText={(value) => setRepeatInterval(value.replace(/[^0-9]/g, "").slice(0, 2))} keyboardType="number-pad" placeholder="2" placeholderTextColor={colors.textSoft} />
            <Text style={styles.repeatSuffix}>{t("ko", "care.setupCustomRepeatSuffix")}</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
  label: { ...type.caption, color: colors.textMuted },
  activeBox: { gap: spacing.xxs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.summaryBorder, backgroundColor: colors.summaryBg, padding: spacing.md },
  activeTitle: { ...type.bodyStrong },
  activeMeta: { ...type.caption, color: colors.summaryAccent },
  row: { gap: spacing.sm },
  flex: { flex: 1 },
  input: { ...type.body, minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  timePicker: {},
  repeatRow: { gap: spacing.sm },
  repeatInput: { maxWidth: 96 },
  repeatSuffix: { ...type.caption, color: colors.textMuted },
  errorText: { ...type.caption, color: colors.coral },
  scheduleRow: { minHeight: 58, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  scheduleTitle: { ...type.bodyStrong },
  scheduleMeta: { ...type.caption, color: colors.textMuted },
  useText: { ...type.caption, color: colors.orangeDeep, fontWeight: "700" },
});

function getLocalDateKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
