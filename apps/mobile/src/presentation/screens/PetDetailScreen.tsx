import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { PetProfile } from "../../contexts/pet/domain/pet";
import { SegmentedControl } from "../../design-system/components";
import { AppIcon, type AppIconName } from "../../design-system/iconography";
import { colors, font, iconSize, layout, radius, spacing, type } from "../../design-system/tokens";
import { t, type TranslationKey } from "../../i18n/translations";
import type { CareDestination, PetDetailRoute, PetSection } from "../navigation/appRoute";
export type PetDetailScreenProps = {
  /** Must match route.petId before rendering any child editor. */
  pet: PetProfile;
  /** Explicit accessible pet and section. */
  route: PetDetailRoute;
  /** Switches sections without changing the pet. */
  onSectionChange: (section: PetSection) => void;
  /** Switches care views without changing the pet. */
  onCareViewChange: (destination: CareDestination) => void;
  /** Existing screen composition; child editors retain their own save contracts. */
  children?: ReactNode;
};

const careViews: { view: CareDestination["view"]; labelKey: TranslationKey; icon: AppIconName }[] = [
  { view: "default", labelKey: "petDetail.dashboard", icon: "today" },
  { view: "diary", labelKey: "petDetail.diary", icon: "diary" },
  { view: "medication", labelKey: "category.medication", icon: "medication" },
  { view: "reports", labelKey: "petDetail.report", icon: "reports" },
];

export function PetDetailScreen({ pet, route, onSectionChange, onCareViewChange, children }: PetDetailScreenProps) {
  if (pet.id !== route.petId) return null;
  const meta = [pet.breed, pet.ageLabel !== "--" ? pet.ageLabel : ""].filter(Boolean).join(" · ");
  return (
    <View style={styles.wrap}>
      {meta ? <Text style={styles.meta} numberOfLines={1}>{meta}</Text> : null}
      <SegmentedControl
        items={[{ label: t("petDetail.sectionCare"), value: "care" }, { label: t("tabs.memories"), value: "memories" }, { label: t("petDetail.sectionProfile"), value: "profile" }]}
        value={route.section}
        onChange={onSectionChange}
      />
      {route.section === "care" ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.views} accessibilityRole="tablist" accessibilityLabel={t("petDetail.careViews").replace("{petName}", pet.name)}>
          {careViews.map((item) => {
            const selected = route.destination.view === item.view;
            return (
              <Pressable key={item.view} accessibilityRole="tab" accessibilityLabel={t(item.labelKey)} accessibilityState={{ selected }} aria-selected={selected} onPress={() => onCareViewChange({ view: item.view } as CareDestination)} style={({ pressed }) => [styles.view, selected && styles.viewActive, pressed && styles.pressed]}>
                <AppIcon name={item.icon} size={iconSize.sm} color={selected ? colors.pendingText : colors.textMuted} />
                <Text style={[styles.viewText, selected && styles.viewTextActive]} numberOfLines={1}>{t(item.labelKey)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, paddingTop: spacing.xxs, paddingBottom: spacing.sm },
  meta: { ...type.caption, color: colors.textMuted, marginTop: -spacing.sm },
  views: { gap: spacing.sm, paddingRight: spacing.sm },
  view: { minHeight: layout.minTouch, paddingHorizontal: spacing.md, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  viewActive: { backgroundColor: colors.surfacePeach, borderColor: colors.segmentActiveBorder },
  pressed: { opacity: 0.72 },
  viewText: { ...type.caption, color: colors.textMuted, fontWeight: font.weight.semibold },
  viewTextActive: { color: colors.pendingText },
});
