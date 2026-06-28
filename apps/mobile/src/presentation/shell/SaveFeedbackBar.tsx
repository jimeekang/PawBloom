import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize, layout, radius, shadow, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import type { SaveFeedback } from "./saveFeedback";

export function SaveFeedbackBar({ feedback, onDismiss }: { feedback: SaveFeedback | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(onDismiss, feedback.tone === "settings" ? 4200 : 3200);
    return () => clearTimeout(timer);
  }, [feedback, onDismiss]);

  if (!feedback) return null;

  const isSettings = feedback.tone === "settings";
  return (
    <Pressable style={[styles.wrap, isSettings && styles.wrapSettings]} onPress={onDismiss}>
      <View style={[styles.iconWrap, isSettings && styles.iconWrapSettings]}>
        <AppIcon name={feedback.icon} size={iconSize.md} color={isSettings ? colors.orangeDeep : colors.mintDeep} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{t("ko", feedback.titleKey)}</Text>
        <Text style={styles.message}>{t("ko", feedback.messageKey)}</Text>
      </View>
      <AppIcon name="check" size={iconSize.sm} color={colors.mintDeep} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: layout.screenPadding,
    right: layout.screenPadding,
    bottom: layout.bottomNavHeight + spacing.md,
    minHeight: 74,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.summaryBorder,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadow.card,
  },
  wrapSettings: {
    borderColor: colors.segmentActiveBorder,
    backgroundColor: colors.surfaceWarm,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.summaryBg,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapSettings: {
    backgroundColor: colors.surfacePeach,
  },
  body: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    ...type.bodyStrong,
  },
  message: {
    ...type.caption,
    color: colors.textMuted,
  },
});
