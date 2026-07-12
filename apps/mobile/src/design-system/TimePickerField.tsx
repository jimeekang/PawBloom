import DateTimePicker, { type DateTimePickerChangeEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "./iconography";
import { colors, iconSize, layout, radius, spacing, type } from "./tokens";
import { formatTimeValue, parseTimeValue } from "./TimePickerField.logic";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function TimePickerField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const selectedDate = parseTimeValue(value);

  function handleValueChange(_event: DateTimePickerChangeEvent, date?: Date) {
    if (Platform.OS !== "ios") setOpen(false);
    if (!date) return;
    onChange(formatTimeValue(date));
  }

  if (Platform.OS === "ios") {
    return (
      <View style={styles.iosWrap}>
        <AppIcon name="time" size={iconSize.md} color={colors.orangeDeep} />
        <DateTimePicker value={selectedDate} mode="time" display="compact" onValueChange={handleValueChange} />
      </View>
    );
  }

  return (
    <View>
      <Pressable style={styles.androidButton} onPress={() => setOpen(true)}>
        <AppIcon name="time" size={iconSize.md} color={colors.orangeDeep} />
        <Text style={styles.value}>{value}</Text>
      </Pressable>
      {open ? <DateTimePicker value={selectedDate} mode="time" display="default" onValueChange={handleValueChange} onDismiss={() => setOpen(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  iosWrap: {
    minHeight: layout.inputHeight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  androidButton: {
    minHeight: layout.inputHeight,
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
});
