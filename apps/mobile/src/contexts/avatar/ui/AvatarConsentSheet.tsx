import { useEffect, useRef, type ReactNode } from "react";
import { AccessibilityInfo, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, findNodeHandle } from "react-native";
import { NoticeBanner, PrimaryButton, SecondaryButton } from "../../../design-system/components";
import { AppIcon, type AppIconName } from "../../../design-system/iconography";
import { colors, iconSize, layout, radius, shadow, spacing, type } from "../../../design-system/tokens";
import { t, type TranslationKey } from "../../../i18n/translations";

/** Bottom sheet shared by consent, progress, result and error. Without onClose it cannot be dismissed (work in flight). */
export function AvatarSheetFrame({ title, reducedMotion, onClose, children }: { title: string; reducedMotion: boolean; onClose?: () => void; children: ReactNode }) {
  const heading = useRef<Text>(null), close = useRef<View>(null);
  // Web moves keyboard focus into the sheet (the close button); native screen readers start at the title.
  function focusHeading() {
    if (Platform.OS === "web") { (close.current as unknown as { focus?: () => void })?.focus?.(); return; }
    const tag = findNodeHandle(heading.current);
    if (tag) AccessibilityInfo.setAccessibilityFocus(tag);
  }
  // onShow is not reliable without a show animation (reduced motion on web), so also move focus after mount.
  useEffect(() => { const id = setTimeout(focusHeading, reducedMotion ? 100 : 350); return () => clearTimeout(id); }, []);
  return (
    <Modal transparent visible animationType={reducedMotion ? "none" : "slide"} onRequestClose={() => onClose?.()} onShow={focusHeading}>
      <View style={styles.backdrop}>
        {onClose ? <Pressable accessibilityRole="button" accessibilityLabel={t("character.ai.close")} focusable={false} style={StyleSheet.absoluteFill} onPress={onClose} /> : null}
        <View accessibilityViewIsModal aria-modal accessibilityLabel={title} style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.content} bounces={false}>
            <View style={styles.header}>
              <Text ref={heading} style={styles.title} accessibilityRole="header">{title}</Text>
              {onClose ? <Pressable ref={close} accessibilityRole="button" accessibilityLabel={t("character.ai.close")} onPress={onClose} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
                <AppIcon name="close" size={iconSize.md} color={colors.text} />
              </Pressable> : null}
            </View>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const points: { icon: AppIconName; key: TranslationKey }[] = [
  { icon: "share", key: "character.ai.consentSend" },
  { icon: "shield", key: "character.ai.consentDelete" },
  { icon: "eye", key: "character.ai.consentScope" },
  { icon: "eyeOff", key: "character.ai.consentMetadata" },
  { icon: "time", key: "character.ai.consentLimit" },
];

/** Shown before every photo pick: the server records this consent version with each job. */
export function AvatarConsentSheet({ reducedMotion, notice, onLibrary, onCamera, onClose }: { reducedMotion: boolean; notice?: TranslationKey | null; onLibrary: () => void; onCamera: () => void; onClose: () => void }) {
  return (
    <AvatarSheetFrame title={t("character.ai.consentTitle")} reducedMotion={reducedMotion} onClose={onClose}>
      <View style={styles.points}>
        {points.map((point) => <View key={point.key} style={styles.point}>
          <View style={styles.pointIcon}><AppIcon name={point.icon} size={iconSize.sm} color={colors.orangeDeep} /></View>
          <Text style={styles.pointText}>{t(point.key)}</Text>
        </View>)}
      </View>
      {notice ? <NoticeBanner text={t(notice)} tone="error" icon="alert" /> : null}
      <View style={styles.actions}>
        <PrimaryButton label={t("character.ai.consentLibrary")} icon="addPhoto" onPress={onLibrary} />
        <SecondaryButton label={t("character.ai.consentCamera")} icon="camera" onPress={onCamera} />
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.textButton}><Text style={styles.link}>{t("character.ai.cancel")}</Text></Pressable>
      </View>
    </AvatarSheetFrame>
  );
}

export const avatarSheetStyles = StyleSheet.create({
  hint: { ...type.body, color: colors.textMuted },
  actions: { gap: spacing.sm },
  textButton: { minHeight: layout.minTouch, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm },
  link: { ...type.bodyStrong, color: colors.pendingText },
});
const styles = StyleSheet.create({
  ...avatarSheetStyles,
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.scrimSoft },
  sheet: { width: "100%", maxWidth: 430, maxHeight: "88%", alignSelf: "center", borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.appBackground, ...shadow.card },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: radius.full, backgroundColor: colors.borderStrong, marginTop: spacing.sm },
  content: { padding: layout.screenPadding, paddingTop: spacing.md, gap: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  title: { ...type.sectionTitle, flex: 1, minWidth: 0 },
  close: { width: layout.minTouch, height: layout.minTouch, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pressed: { backgroundColor: colors.surfaceWarm },
  points: { gap: spacing.md },
  point: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  pointIcon: { width: 32, height: 32, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfacePeach },
  pointText: { ...type.body, flex: 1, minWidth: 0, paddingTop: spacing.xxs },
});
