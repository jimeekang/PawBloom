import type { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon, type AppIconName } from "./iconography";
import { colors, font, iconSize, layout, radius, shadow, spacing, type } from "./tokens";

export function SurfaceCard({ children, padded = true }: PropsWithChildren<{ padded?: boolean }>) {
  return <View style={[styles.surface, padded && styles.padded]}>{children}</View>;
}

export function SectionHeader({ title, action, onActionPress }: { title: string; action?: string; onActionPress?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onActionPress ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onActionPress}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : action ? (
        <Text style={styles.sectionAction}>{action}</Text>
      ) : null}
    </View>
  );
}

export function IconBubble({ name, color, background, size = 58 }: { name: AppIconName; color: string; background: string; size?: number }) {
  return (
    <View style={[styles.iconBubble, { width: size, height: size, borderRadius: size / 2, backgroundColor: background }]}>
      <AppIcon name={name} size={size >= 56 ? iconSize.lg : iconSize.md} color={color} />
    </View>
  );
}

export function PrimaryButton({ label, icon, onPress, disabled = false }: { label: string; icon?: AppIconName; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={({ pressed }) => [styles.primaryButton, pressed && !disabled && styles.primaryButtonPressed, disabled && styles.buttonDisabled]}
      onPress={onPress}
    >
      {icon ? <AppIcon name={icon} size={iconSize.sm} color={colors.white} /> : null}
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, icon, onPress, disabled = false }: { label: string; icon?: AppIconName; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={({ pressed }) => [styles.secondaryButton, pressed && !disabled && styles.secondaryButtonPressed, disabled && styles.buttonDisabled]}
      onPress={onPress}
    >
      {icon ? <AppIcon name={icon} size={iconSize.sm} color={colors.orangeDeep} /> : null}
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function OutlineIconButton({ icon, onPress }: { icon: AppIconName; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" style={({ pressed }) => [styles.outlineIconButton, pressed && styles.outlineIconButtonPressed]} onPress={onPress}>
      <AppIcon name={icon} size={iconSize.md} color={colors.text} />
    </Pressable>
  );
}

export type NoticeTone = "success" | "error";

export function NoticeBanner({ text, icon = "check", tone = "success" }: { text: string; icon?: AppIconName; tone?: NoticeTone }) {
  const isError = tone === "error";
  return (
    <View style={[styles.noticeBanner, isError && styles.noticeBannerError]}>
      <AppIcon name={icon} size={iconSize.sm} color={isError ? colors.danger : colors.mintDeep} />
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {items.map((item) => (
        <Pressable
          key={item.value}
          accessibilityRole="radio"
          accessibilityLabel={item.label}
          accessibilityState={{ checked: value === item.value }}
          aria-checked={value === item.value}
          style={[styles.segment, value === item.value && styles.segmentActive]}
          onPress={() => onChange(item.value)}
        >
          <Text style={[styles.segmentText, value === item.value && styles.segmentTextActive]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  padded: {
    padding: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...type.sectionTitle,
  },
  sectionAction: {
    ...type.caption,
    color: colors.orangeDeep,
    fontWeight: font.weight.semibold,
  },
  iconBubble: {
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    minHeight: layout.buttonHeight,
    borderRadius: radius.md,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    ...shadow.card,
  },
  primaryButtonPressed: {
    backgroundColor: colors.orangePressed,
  },
  primaryButtonText: {
    ...type.sectionTitle,
    color: colors.white,
    fontWeight: font.weight.bold,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  secondaryButton: {
    minHeight: layout.buttonHeight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  secondaryButtonPressed: {
    backgroundColor: colors.surfaceWarm,
  },
  secondaryButtonText: {
    ...type.bodyStrong,
    color: colors.orangeDeep,
  },
  outlineIconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  outlineIconButtonPressed: {
    backgroundColor: colors.surfaceWarm,
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 2,
  },
  segment: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "transparent",
  },
  segmentActive: {
    backgroundColor: colors.surfacePeach,
    borderColor: colors.segmentActiveBorder,
  },
  segmentText: {
    ...type.body,
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.orangeDeep,
    fontWeight: font.weight.semibold,
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
