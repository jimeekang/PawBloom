import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ActiveCareSetup, CareSetupInput } from "../domain/carePlan";
import { PrimaryButton, SegmentedControl, SurfaceCard } from "../../../design-system/components";
import { colors, radius, spacing, type } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";
import { DatePickerField } from "../../../design-system/DatePickerField";
import { TimePickerField } from "../../../design-system/TimePickerField";

type RepeatOption = "daily" | "custom";

export function ProfileCareDefaultsPanel({ setup, onSave }: { setup: ActiveCareSetup; onSave: (input: CareSetupInput) => void }) {
  const [conditionName, setConditionName] = useState(setup.conditionName ?? "");
  const [planTitle, setPlanTitle] = useState(setup.planTitle ?? "");
  const [medicationName, setMedicationName] = useState("");
  const [dosageLabel, setDosageLabel] = useState("");
  const [startsOn, setStartsOn] = useState(currentDateKey());
  const [endsOn, setEndsOn] = useState("");
  const [repeat, setRepeat] = useState<RepeatOption>("daily");
  const [repeatDays, setRepeatDays] = useState("2");
  const [times, setTimes] = useState(["08:00"]);

  function save() {
    onSave({
      conditionName: conditionName.trim(),
      planTitle: planTitle.trim(),
      medicationName: medicationName.trim(),
      dosageLabel: dosageLabel.trim(),
      localTimes: times,
      startsOn,
      endsOn: endsOn || undefined,
      recurrenceIntervalDays: repeat === "daily" ? 1 : normalizeRepeatDays(repeatDays),
    });
    setMedicationName("");
    setDosageLabel("");
  }

  return (
    <SurfaceCard>
      <View style={styles.panel}>
        <Text style={styles.title}>{t("ko", "pet.careDefaultsTitle")}</Text>
        <Text style={styles.copy}>{t("ko", "pet.careDefaultsCopy")}</Text>
        {setup.conditions.map((condition) => (
          <Text key={condition.id} style={styles.savedText}>{condition.name}</Text>
        ))}
        {setup.schedules.map((schedule) => (
          <Text key={schedule.id} style={styles.savedText}>{schedule.localTime.slice(0, 5)} · {schedule.medicationName} · {schedule.dosageLabel}</Text>
        ))}
        <TextInput style={styles.input} value={conditionName} onChangeText={(value) => setConditionName(value.slice(0, 80))} placeholder={t("ko", "care.conditionPlaceholder")} placeholderTextColor={colors.textSoft} />
        <TextInput style={styles.input} value={planTitle} onChangeText={(value) => setPlanTitle(value.slice(0, 80))} placeholder={t("ko", "care.planPlaceholder")} placeholderTextColor={colors.textSoft} />
        <TextInput style={styles.input} value={medicationName} onChangeText={(value) => setMedicationName(value.slice(0, 80))} placeholder={t("ko", "care.medicationPlaceholder")} placeholderTextColor={colors.textSoft} />
        <TextInput style={styles.input} value={dosageLabel} onChangeText={(value) => setDosageLabel(value.slice(0, 80))} placeholder={t("ko", "care.dosagePlaceholder")} placeholderTextColor={colors.textSoft} />
        <Text style={styles.label}>{t("ko", "pet.careDefaultsPeriod")}</Text>
        <DatePickerField value={startsOn} onChange={setStartsOn} placeholder={t("ko", "pet.careDefaultsStartDate")} />
        <DatePickerField value={endsOn} onChange={setEndsOn} placeholder={t("ko", "pet.careDefaultsEndDate")} allowClear clearLabel={t("ko", "pet.careDefaultsClearDate")} />
        <Text style={styles.label}>{t("ko", "pet.careDefaultsRepeat")}</Text>
        <SegmentedControl value={repeat} onChange={setRepeat} items={[{ label: t("ko", "pet.careDefaultsEveryDay"), value: "daily" }, { label: t("ko", "pet.careDefaultsCustomRepeat"), value: "custom" }]} />
        {repeat === "custom" ? (
          <View style={styles.repeatRow}>
            <TextInput style={[styles.input, styles.repeatInput]} value={repeatDays} onChangeText={(value) => setRepeatDays(value.replace(/[^0-9]/g, "").slice(0, 3))} keyboardType="number-pad" placeholder="2" placeholderTextColor={colors.textSoft} />
            <Text style={styles.repeatSuffix}>{t("ko", "pet.careDefaultsCustomRepeatSuffix")}</Text>
          </View>
        ) : null}
        {times.map((time, index) => (
          <TimePickerField key={`${index}-${time}`} value={time} onChange={(nextTime) => setTimes((current) => current.map((item, itemIndex) => (itemIndex === index ? nextTime : item)))} />
        ))}
        <Pressable style={styles.addTimeButton} onPress={() => setTimes((current) => [...current, "20:00"])}>
          <Text style={styles.addTimeText}>{t("ko", "pet.careDefaultsTimeAdd")}</Text>
        </Pressable>
        <Text style={styles.copy}>{t("ko", "pet.careDefaultsSavedHint")}</Text>
        <PrimaryButton label={t("ko", "care.setupSave")} icon="medication" onPress={save} />
      </View>
    </SurfaceCard>
  );
}

function normalizeRepeatDays(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, parsed);
}

function currentDateKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md },
  title: { ...type.sectionTitle },
  copy: { ...type.caption, color: colors.textMuted },
  label: { ...type.caption, color: colors.text },
  savedText: { ...type.caption, color: colors.textMuted },
  input: { ...type.body, minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  repeatRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  repeatInput: { width: 96, flex: 0 },
  repeatSuffix: { ...type.body, color: colors.textMuted, flex: 1 },
  addTimeButton: { minHeight: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  addTimeText: { ...type.bodyStrong, color: colors.orangeDeep },
});
