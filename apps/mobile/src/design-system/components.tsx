import type { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon, type AppIconName } from "./iconography";
import { colors, iconSize, layout, radius, shadow, spacing, type } from "./tokens";

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

export function PrimaryButton({ label, icon, onPress }: { label: string; icon?: AppIconName; onPress?: () => void }) {
  return (
    <Pressable style={styles.primaryButton} onPress={onPress}>
      {icon ? <AppIcon name={icon} size={iconSize.sm} color={colors.white} /> : null}
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, icon, onPress }: { label: string; icon?: AppIconName; onPress?: () => void }) {
  return (
    <Pressable style={styles.secondaryButton} onPress={onPress}>
      {icon ? <AppIcon name={icon} size={iconSize.sm} color={colors.orangeDeep} /> : null}
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function OutlineIconButton({ icon, onPress }: { icon: AppIconName; onPress?: () => void }) {
  return (
    <Pressable style={styles.outlineIconButton} onPress={onPress}>
      <AppIcon name={icon} size={iconSize.md} color={colors.text} />
    </Pressable>
  );
}

export function NoticeBanner({ text, icon = "check" }: { text: string; icon?: AppIconName }) {
  return (
    <View style={styles.noticeBanner}>
      <AppIcon name={icon} size={iconSize.sm} color={colors.mintDeep} />
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
        <Pressable key={item.value} style={[styles.segment, value === item.value && styles.segmentActive]} onPress={() => onChange(item.value)}>
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
    ...type.tiny,
    color: colors.orangeDeep,
    fontWeight: "600",
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
  primaryButtonText: {
    ...type.sectionTitle,
    color: colors.white,
    fontWeight: "700",
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
  secondaryButtonText: {
    ...type.bodyStrong,
    color: colors.orangeDeep,
  },
  outlineIconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
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
  },
  segmentActive: {
    backgroundColor: colors.surfacePeach,
    borderWidth: 1,
    borderColor: colors.segmentActiveBorder,
  },
  segmentText: {
    ...type.body,
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.orangeDeep,
    fontWeight: "600",
  },
  noticeBanner: {
    minHeight: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  noticeText: {
    ...type.caption,
    flex: 1,
    color: colors.text,
  },
});
