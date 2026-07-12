import DateTimePicker, { type DateTimePickerChangeEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "./iconography";
import { colors, iconSize, radius, spacing, type } from "./tokens";
import { displayTimeValue, formatTimeValue, parseTimeValue } from "./TimePickerField.logic";

type Props = {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
};

export function TimePickerField({ value, placeholder = "", onChange }: Props) {
  const [open, setOpen] = useState(false);
  const selectedDate = parseTimeValue(value);

  function handleValueChange(_event: DateTimePickerChangeEvent, date?: Date) {
    setOpen(false);
    if (!date) return;
    onChange(formatTimeValue(date));
  }

  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel={displayTimeValue(value, placeholder)} style={styles.androidButton} onPress={() => setOpen(true)}>
        <AppIcon name="time" size={iconSize.md} color={colors.orangeDeep} />
        <Text style={[styles.value, !value && styles.placeholder]}>{displayTimeValue(value, placeholder)}</Text>
      </Pressable>
      {open ? <DateTimePicker value={selectedDate} mode="time" display={Platform.OS === "ios" ? "spinner" : "default"} onValueChange={handleValueChange} onDismiss={() => setOpen(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
  placeholder: {
    color: colors.textSoft,
  },
});
