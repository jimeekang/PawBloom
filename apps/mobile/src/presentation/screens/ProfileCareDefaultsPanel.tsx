import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ActiveCareSetup, CareSetupInput } from "../../contexts/care/domain/carePlan";
import { PrimaryButton, SegmentedControl, SurfaceCard } from "../../design-system/components";
import { colors, radius, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import { TimePickerField } from "../ui/TimePickerField";

type RepeatOption = "1" | "2";

export function ProfileCareDefaultsPanel({ setup, onSave }: { setup: ActiveCareSetup; onSave: (input: CareSetupInput) => void }) {
  const [conditionName, setConditionName] = useState(setup.conditionName ?? "");
  const [planTitle, setPlanTitle] = useState(setup.planTitle ?? "");
  const [medicationName, setMedicationName] = useState("");
  const [dosageLabel, setDosageLabel] = useState("");
  const [startsOn, setStartsOn] = useState(currentDateKey());
  const [endsOn, setEndsOn] = useState("");
  const [repeat, setRepeat] = useState<RepeatOption>("1");
  const [times, setTimes] = useState(["08:00"]);

  function save() {
    for (const localTime of times) {
      onSave({ conditionName: conditionName.trim(), planTitle: planTitle.trim(), medicationName: medicationName.trim(), dosageLabel: dosageLabel.trim(), localTime, startsOn: startsOn.trim(), endsOn: endsOn.trim() || undefined, recurrenceIntervalDays: Number(repeat) });
    }
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
        <TextInput style={styles.input} value={startsOn} onChangeText={(value) => setStartsOn(value.slice(0, 10))} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSoft} />
        <TextInput style={styles.input} value={endsOn} onChangeText={(value) => setEndsOn(value.slice(0, 10))} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSoft} />
        <Text style={styles.label}>{t("ko", "pet.careDefaultsRepeat")}</Text>
        <SegmentedControl value={repeat} onChange={setRepeat} items={[{ label: t("ko", "pet.careDefaultsEveryDay"), value: "1" }, { label: t("ko", "pet.careDefaultsEveryTwoDays"), value: "2" }]} />
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
  addTimeButton: { minHeight: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  addTimeText: { ...type.bodyStrong, color: colors.orangeDeep },
});
