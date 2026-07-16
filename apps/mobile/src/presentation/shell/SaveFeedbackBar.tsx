import { useEffect } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize, layout, radius, shadow, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import type { SaveFeedback } from "./saveFeedback";

const headerOffset = 76;

export function SaveFeedbackBar({ feedback, onDismiss }: { feedback: SaveFeedback | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!feedback) return;
    AccessibilityInfo.announceForAccessibility(`${t("ko", feedback.titleKey)}. ${t("ko", feedback.messageKey)}`);
    const timer = setTimeout(onDismiss, feedback.tone === "settings" ? 4200 : 3200);
    return () => clearTimeout(timer);
  }, [feedback, onDismiss]);

  if (!feedback) return null;

  const isSettings = feedback.tone === "settings";
  const title = t("ko", feedback.titleKey);
  const message = t("ko", feedback.messageKey);
  const accentColor = isSettings ? colors.orangeDeep : colors.mintDeep;

  return (
    <Pressable accessibilityRole="button" style={[styles.wrap, isSettings && styles.wrapSettings]} onPress={onDismiss} accessibilityLabel={`${title}. ${message}`} accessibilityLiveRegion="polite">
      <View style={[styles.accent, { backgroundColor: accentColor }]} />
      <View style={[styles.iconWrap, isSettings && styles.iconWrapSettings]}>
        <AppIcon name={feedback.icon} size={iconSize.md} color={colors.white} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
      <View style={[styles.checkWrap, isSettings && styles.checkWrapSettings]}>
        <AppIcon name="check" size={iconSize.sm} color={accentColor} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: layout.screenPadding,
    right: layout.screenPadding,
    top: headerOffset,
    zIndex: 20,
    minHeight: 86,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.summaryBorder,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.md,
    paddingVertical: spacing.md,
    ...shadow.card,
  },
  wrapSettings: {
    borderColor: colors.segmentActiveBorder,
    backgroundColor: colors.surfaceWarm,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.mintDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapSettings: {
    backgroundColor: colors.orangeDeep,
  },
  body: {
    flex: 1,
    gap: spacing.xxs,
  },
  accent: {
    position: "absolute",
    left: 0,
    top: spacing.md,
    bottom: spacing.md,
    width: 6,
    borderTopRightRadius: radius.full,
    borderBottomRightRadius: radius.full,
  },
  title: {
    ...type.sectionTitle,
  },
  message: {
    ...type.body,
    color: colors.textMuted,
  },
  checkWrap: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: colors.summaryBg,
    alignItems: "center",
    justifyContent: "center",
  },
  checkWrapSettings: {
    backgroundColor: colors.surfacePeach,
  },
});
