import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon, type AppIconName } from "../../design-system/iconography";
import { colors, iconSize, layout, spacing, type } from "../../design-system/tokens";
import { t, type TranslationKey } from "../../i18n/translations";

export type MainTab = "today" | "diary" | "care" | "reports" | "settings";

const navItems: { key: MainTab; labelKey: TranslationKey; icon: AppIconName; activeIcon?: AppIconName }[] = [
  { key: "today", labelKey: "tabs.today", icon: "home", activeIcon: "homeFilled" },
  { key: "diary", labelKey: "tabs.diary", icon: "diary" },
  { key: "care", labelKey: "tabs.care", icon: "care" },
  { key: "reports", labelKey: "tabs.reports", icon: "reports" },
  { key: "settings", labelKey: "tabs.settings", icon: "settings" },
];

export function BottomNav({ activeTab, onChange }: { activeTab: MainTab; onChange: (tab: MainTab) => void }) {
  return (
    <View style={styles.nav}>
      {navItems.map((item) => {
        const active = activeTab === item.key;
        return (
          <Pressable key={item.key} style={styles.item} onPress={() => onChange(item.key)}>
            <AppIcon name={active && item.activeIcon ? item.activeIcon : item.icon} size={iconSize.md} color={active ? colors.orangeDeep : colors.textMuted} />
            <Text style={[styles.label, active && styles.labelActive]}>{t("ko", item.labelKey)}</Text>
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
    alignItems: "center",
    gap: spacing.xs,
  },
  label: {
    ...type.tiny,
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.orangeDeep,
    fontWeight: "600",
  },
});
