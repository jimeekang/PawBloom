import { Pressable, StyleSheet } from "react-native";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize, layout, radius } from "../../design-system/tokens";

export function HouseScenePageButton({ label, icon, disabled, onPress }: { label: string; icon: "back" | "forward"; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}>
      <AppIcon name={icon} size={iconSize.sm} color={colors.text} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: { width: layout.minTouch, height: layout.minTouch, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  pressed: { backgroundColor: colors.surfaceWarm },
  disabled: { opacity: 0.4 },
});
