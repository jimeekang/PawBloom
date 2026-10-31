import { useRef } from "react";
import { AccessibilityInfo, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, findNodeHandle, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DiaryMemoryPetState } from "../../contexts/diary/application/diaryMemories";
import type { PetProfile } from "../../contexts/pet/domain/pet";
import { AppIcon, type AppIconName } from "../../design-system/iconography";
import { colors, font, iconSize, layout, radius, shadow, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import type { PetSection } from "../navigation/appRoute";
import { memoryText } from "../screens/MemoriesScreen";
import type { TodayCarePetState } from "../screens/TodayCareScreen";
import { petCareLine } from "./HousePetList";
import { PetAvatar, usePetPhoto } from "./PetAvatar";
import { usePetAppearance } from "../../contexts/avatar/application/usePetAppearance";
import { CharacterSvg } from "../../contexts/avatar/ui/CharacterSvg";

export type PetSummarySheetProps = {
  pet: PetProfile;
  userId: string | null;
  careState?: TodayCarePetState;
  memoryState?: DiaryMemoryPetState;
  /** Names the pet the quick record will be saved for. */
  quickRecordLabel: string;
  onClose: () => void;
  onOpenSection: (section: PetSection) => void;
  onQuickRecord: () => void;
  onEditAppearance?: () => void;
  reducedMotion?: boolean;
  motionEnabled?: boolean;
};

/** Short tap result: who this is, today's facts, recent memories, and the ways in. */
export function PetSummarySheet({ pet, userId, careState, memoryState, quickRecordLabel, onClose, onOpenSection, onQuickRecord, onEditAppearance, reducedMotion = true, motionEnabled = false }: PetSummarySheetProps) {
  const dimensions = useWindowDimensions();
  const { appearance } = usePetAppearance(userId, pet.id, pet.species);
  const photo = usePetPhoto(pet.id, userId);
  const closeNode = useRef<View>(null);
  function focusClose() {
    if (Platform.OS === "web") { (closeNode.current as unknown as { focus?: () => void })?.focus?.(); return; }
    const tag = findNodeHandle(closeNode.current);
    if (tag) AccessibilityInfo.setAccessibilityFocus(tag);
  }
  const insets = useSafeAreaInsets();
  const meta = [pet.breed, pet.ageLabel !== "--" ? pet.ageLabel : ""].filter(Boolean).join(" · ");
  const memories = memoryState?.status === "ready"
    ? [...memoryState.items].filter((item) => item.entry.petId === pet.id).sort((a, b) => `${b.entry.entryDate} ${b.entry.occurredAt}`.localeCompare(`${a.entry.entryDate} ${a.entry.occurredAt}`)).slice(0, 3)
    : [];
  return (
    <Modal transparent visible animationType={reducedMotion ? "none" : "slide"} onRequestClose={onClose} onShow={focusClose}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("house.summaryClose")} focusable={false} style={StyleSheet.absoluteFill} onPress={onClose} />
        <View accessibilityViewIsModal aria-modal accessibilityLabel={pet.name} style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: layout.screenPadding + insets.bottom }]} bounces={false}>
            <View style={styles.header}>
              <CharacterSvg species={pet.species} appearance={appearance} size={dimensions.width < 375 ? 72 : 96} withBody motion={{ id: pet.id, enabled: motionEnabled, paused: true, reduced: reducedMotion }} />
              <View style={styles.headerText}>
                <Text style={styles.name} accessibilityRole="header" numberOfLines={2}>{pet.name}</Text>
                {meta ? <Text style={styles.meta} numberOfLines={2}>{meta}</Text> : null}
                {onEditAppearance ? <Pressable accessibilityRole="button" onPress={onEditAppearance} style={styles.edit}><Text style={styles.editText}>{t("character.edit")}</Text></Pressable> : null}
                {photo ? <PetAvatar pet={pet} userId={userId} size={24} /> : null}
              </View>
              <Pressable ref={closeNode} accessibilityRole="button" accessibilityLabel={t("house.summaryClose")} onPress={onClose} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
                <AppIcon name="close" size={iconSize.md} color={colors.text} />
              </Pressable>
            </View>
            <View style={styles.todayCard}>
              <AppIcon name="today" size={iconSize.sm} color={colors.orangeDeep} />
              <Text style={styles.todayText}>{petCareLine(careState)}</Text>
            </View>
            <Text style={styles.sectionTitle} accessibilityRole="header">{t("house.summaryMemories")}</Text>
            {memoryState?.status === "error" ? <Text style={styles.muted}>{t("memories.petLoadFailed").replace("{petName}", pet.name)}</Text>
              : !memoryState || memoryState.status === "loading" ? <Text style={styles.muted}>{t("memories.petLoading").replace("{petName}", pet.name)}</Text>
              : !memories.length ? <Text style={styles.muted}>{t("memories.emptyDiary")}</Text>
              : <View style={styles.memories}>
                {memories.map(({ entry }) => (
                  <View key={entry.id} style={styles.memory} accessible accessibilityLabel={[entry.entryDate, memoryText(entry) || t("category.photo")].join(", ")}>
                    {entry.photoUrls?.[0] ? <Image source={{ uri: entry.photoUrls[0] }} accessibilityIgnoresInvertColors style={styles.memoryPhoto} /> : <Text style={styles.memoryText} numberOfLines={3}>{memoryText(entry) || t("category.photo")}</Text>}
                    <Text style={styles.memoryDate} numberOfLines={1}>{entry.entryDate.slice(5).replace("-", ".")}</Text>
                  </View>
                ))}
              </View>}
            <View style={styles.actions}>
              <Action icon="care" label={t("petDetail.sectionCare")} onPress={() => onOpenSection("care")} />
              <Action icon="memories" label={t("tabs.memories")} onPress={() => onOpenSection("memories")} />
              <Action icon="profile" label={t("petDetail.sectionProfile")} onPress={() => onOpenSection("profile")} />
              <Action icon="add" label={t("house.quickRecord")} accessibilityLabel={quickRecordLabel} primary onPress={onQuickRecord} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Action({ icon, label, accessibilityLabel, primary = false, onPress }: { icon: AppIconName; label: string; accessibilityLabel?: string; primary?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} style={({ pressed }) => [styles.action, primary && styles.actionPrimary, pressed && (primary ? styles.actionPrimaryPressed : styles.pressed)]}>
      <AppIcon name={icon} size={iconSize.sm} color={primary ? colors.white : colors.pendingText} />
      <Text style={[styles.actionText, primary && styles.actionTextPrimary]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.scrimSoft },
  sheet: { width: "100%", maxWidth: 430, maxHeight: "86%", alignSelf: "center", borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.appBackground, ...shadow.card },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: radius.full, backgroundColor: colors.borderStrong, marginTop: spacing.sm },
  content: { padding: layout.screenPadding, paddingTop: spacing.md, gap: spacing.md },
  edit: { minHeight: layout.minTouch, justifyContent: "center" },
  editText: { ...type.caption, color: colors.pendingText },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...type.brand, fontSize: 22, lineHeight: 28 },
  meta: { ...type.caption },
  close: { width: layout.minTouch, height: layout.minTouch, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pressed: { backgroundColor: colors.surfaceWarm },
  todayCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  todayText: { ...type.body, flex: 1 },
  sectionTitle: { ...type.bodyStrong, marginTop: spacing.xxs },
  muted: { ...type.caption },
  memories: { flexDirection: "row", gap: spacing.sm },
  memory: { flexGrow: 1, flexBasis: 0, maxWidth: "32%", minHeight: 92, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.xs, gap: spacing.xxs, overflow: "hidden" },
  memoryPhoto: { width: "100%", aspectRatio: 1, borderRadius: radius.xs, backgroundColor: colors.surfaceWarm },
  memoryText: { ...type.caption, color: colors.text },
  memoryDate: { ...type.tiny, marginTop: "auto" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  action: { flexGrow: 1, flexBasis: "46%", minHeight: layout.minTouch + 4, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingHorizontal: spacing.sm },
  actionPrimary: { backgroundColor: colors.orangePressed, borderColor: colors.orangePressed },
  actionPrimaryPressed: { backgroundColor: colors.pendingText },
  actionText: { ...type.bodyStrong, color: colors.pendingText, flexShrink: 1 },
  actionTextPrimary: { color: colors.white, fontWeight: font.weight.bold },
});
