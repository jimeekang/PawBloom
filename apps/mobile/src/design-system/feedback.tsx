import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon, type AppIconName } from "./iconography";
import { colors, iconSize, layout, radius, spacing, type } from "./tokens";

// Shared destructive action button (0006 D2): one danger visual language for
// account deletion, record deletion, and caregiver removal.
export function DangerButton({ label, icon, onPress, disabled = false, busy = false }: { label: string; icon?: AppIconName; onPress?: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      style={({ pressed }) => [styles.dangerButton, pressed && !disabled && styles.dangerButtonPressed, disabled && styles.buttonDisabled]}
      onPress={onPress}
    >
      {busy ? <ActivityIndicator size="small" color={colors.danger} /> : icon ? <AppIcon name={icon} size={iconSize.sm} color={colors.danger} /> : null}
      <Text style={styles.dangerButtonText}>{label}</Text>
    </Pressable>
  );
}

export type NoticeTone = "success" | "error" | "progress";

export function NoticeBanner({ text, icon = "check", tone = "success" }: { text: string; icon?: AppIconName; tone?: NoticeTone }) {
  const isError = tone === "error";
  const iconColor = isError ? colors.danger : tone === "progress" ? colors.textMuted : colors.mintDeep;
  return (
    <View
      accessibilityRole={isError ? "alert" : undefined}
      accessibilityLiveRegion={isError ? "assertive" : "polite"}
      style={[styles.noticeBanner, isError && styles.noticeBannerError]}
    >
      <AppIcon name={icon} size={iconSize.sm} color={iconColor} />
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonDisabled: {
    opacity: 0.55,
  },
  dangerButton: {
    minHeight: layout.buttonHeight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerBg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  dangerButtonPressed: {
    backgroundColor: colors.surfacePeach,
  },
  dangerButtonText: {
    ...type.bodyStrong,
    color: colors.danger,
  },
  noticeBanner: {
    minHeight: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  noticeBannerError: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
  },
  noticeText: {
    ...type.caption,
    flex: 1,
    color: colors.text,
  },
});
