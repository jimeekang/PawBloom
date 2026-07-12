import DateTimePicker, { type DateTimePickerChangeEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "./iconography";
import { colors, iconSize, radius, spacing, type } from "./tokens";
import { formatDateValue, parseDateValue } from "./DatePickerField.logic";

type Props = {
  value?: string;
  onChange: (value: string) => void;
  placeholder: string;
  allowClear?: boolean;
  clearLabel?: string;
};

export function DatePickerField({ value, onChange, placeholder, allowClear = false, clearLabel = "Clear" }: Props) {
  const [open, setOpen] = useState(false);
  const selectedDate = parseDateValue(value);
  const displayValue = value || placeholder;

  function handleValueChange(_event: DateTimePickerChangeEvent, date?: Date) {
    if (Platform.OS !== "ios") setOpen(false);
    if (!date) return;
    onChange(formatDateValue(date));
  }

  if (Platform.OS === "ios") {
    return (
      <View style={styles.wrap}>
        <View style={styles.valueRow}>
          <AppIcon name="calendar" size={iconSize.md} color={colors.orangeDeep} />
          <Text style={[styles.value, !value && styles.placeholder]}>{displayValue}</Text>
        </View>
        <DateTimePicker value={selectedDate} mode="date" display="compact" onValueChange={handleValueChange} />
        {allowClear && value ? (
          <Pressable onPress={() => onChange("")} hitSlop={8}>
            <Text style={styles.clearText}>{clearLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.androidStack}>
      <Pressable style={styles.androidButton} onPress={() => setOpen(true)}>
        <AppIcon name="calendar" size={iconSize.md} color={colors.orangeDeep} />
        <Text style={[styles.value, !value && styles.placeholder]}>{displayValue}</Text>
      </Pressable>
      {allowClear && value ? (
        <Pressable style={styles.clearButton} onPress={() => onChange("")}>
          <Text style={styles.clearText}>{clearLabel}</Text>
        </Pressable>
      ) : null}
      {open ? <DateTimePicker value={selectedDate} mode="date" display="default" onValueChange={handleValueChange} onDismiss={() => setOpen(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  valueRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  androidStack: {
    gap: spacing.sm,
  },
  androidButton: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  value: {
    ...type.bodyStrong,
    flex: 1,
  },
  placeholder: {
    color: colors.textSoft,
    fontWeight: "400",
  },
  clearButton: {
    minHeight: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: {
    ...type.caption,
    color: colors.orangeDeep,
    fontWeight: "700",
  },
});
