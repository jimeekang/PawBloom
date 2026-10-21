import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon, type AppIconName } from "../../design-system/iconography";
import { colors, font, iconSize, layout, radius, spacing, type } from "../../design-system/tokens";
import { t, type TranslationKey } from "../../i18n/translations";

import type { MainTab } from "../navigation/appRoute";
export type { MainTab } from "../navigation/appRoute";

/** Four main destinations; detail screens highlight house. */
export type BottomNavProps = {
  /** Selected main destination. */
  activeTab: MainTab;
  /** Selects a main destination without choosing an implicit pet. */
  onChange: (tab: MainTab) => void;
};

const navItems: { key: MainTab; labelKey: TranslationKey; icon: AppIconName; activeIcon?: AppIconName }[] = [
  { key: "house", labelKey: "tabs.house", icon: "home", activeIcon: "homeFilled" },
  { key: "care", labelKey: "tabs.care", icon: "today", activeIcon: "todayFilled" },
  { key: "memories", labelKey: "tabs.memories", icon: "memories", activeIcon: "memoriesFilled" },
  { key: "more", labelKey: "tabs.more", icon: "more", activeIcon: "moreFilled" },
];

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  return (
    <View style={styles.nav} accessibilityRole="tablist">
      {navItems.map((item) => {
        const active = activeTab === item.key;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            aria-selected={active}
            accessibilityLabel={t(item.labelKey)}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            onPress={() => onChange(item.key)}
          >
            <View style={[styles.iconPill, active && styles.iconPillActive]}>
              <AppIcon name={active && item.activeIcon ? item.activeIcon : item.icon} size={iconSize.md} color={active ? colors.orangeDeep : colors.textMuted} />
            </View>
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>{t(item.labelKey)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    minHeight: layout.bottomNavHeight,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  item: {
    flex: 1,
    minHeight: 56,
    alignItems: "center",
    gap: spacing.xxs,
  },
  itemPressed: {
    opacity: 0.6,
  },
  iconPill: {
    width: 56,
    height: 32,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  iconPillActive: {
    backgroundColor: colors.surfacePeach,
  },
  label: {
    ...type.tiny,
    color: colors.textMuted,
    maxWidth: "100%",
  },
  labelActive: {
    color: colors.orangeDeep,
    fontWeight: font.weight.semibold,
  },
});
