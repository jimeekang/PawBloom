import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize, radius, spacing, type } from "../../design-system/tokens";
import { formatTimeValue, parseTimeValue } from "./TimePickerField.logic";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function TimePickerField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const selectedDate = parseTimeValue(value);

  function handleChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS !== "ios") setOpen(false);
    if (event.type === "dismissed" || !date) return;
    onChange(formatTimeValue(date));
  }

  if (Platform.OS === "ios") {
    return (
      <View style={styles.iosWrap}>
        <AppIcon name="time" size={iconSize.md} color={colors.orangeDeep} />
        <DateTimePicker value={selectedDate} mode="time" display="compact" onChange={handleChange} />
      </View>
    );
  }

  return (
    <View>
      <Pressable style={styles.androidButton} onPress={() => setOpen(true)}>
        <AppIcon name="time" size={iconSize.md} color={colors.orangeDeep} />
        <Text style={styles.value}>{value}</Text>
      </Pressable>
      {open ? <DateTimePicker value={selectedDate} mode="time" display="default" onChange={handleChange} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  iosWrap: {
    minHeight: 48,
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
});
