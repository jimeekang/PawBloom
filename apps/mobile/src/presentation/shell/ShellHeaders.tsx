import { Pressable, Text, View, StyleSheet } from "react-native";
import { colors, font, iconSize, layout, radius, spacing, type } from "../../design-system/tokens";
import { AppIcon, type AppIconName } from "../../design-system/iconography";
import { t } from "../../i18n/translations";
export type HouseHeaderProps = {
  /** Opens the existing gated pet creation path. */
  onAddPet: () => void;
  /** Opens target selection; no record is saved until a named pet is confirmed. */
  onRequestRecord: () => void;
};
export type PetDetailHeaderProps = {
  /** Name of route.petId, visible throughout recording. */
  petName: string;
  /** Subview to section, then detail to house, matching Android back. */
  onBack: () => void;
};
export type PetSettingsHeaderProps = {
  /** Leaves the dedicated creation route using the same back behavior as Android. */
  onBack: () => void;
};
export type ShellTitleHeaderProps = {
  /** Localized title matching the currently selected main tab; never an implicit pet name. */
  title: string;
};
export function HouseHeader({ onAddPet, onRequestRecord }: HouseHeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.tabTitle} accessibilityRole="header" numberOfLines={1}>{t("tabs.house")}</Text>
      <View style={styles.actions}>
        <HeaderAction icon="add" label={t("pet.create")} onPress={onAddPet} />
        <HeaderAction icon="memo" label={t("house.record")} primary onPress={onRequestRecord} />
      </View>
    </View>
  );
}
export function PetDetailHeader({ petName, onBack }: PetDetailHeaderProps) {
  return <View style={styles.header}><BackButton onBack={onBack} /><Text style={styles.detailTitle} accessibilityRole="header" numberOfLines={1}>{petName}</Text><View style={styles.spacer} /></View>;
}
export function PetSettingsHeader({ onBack }: PetSettingsHeaderProps) {
  return <View style={styles.header}><BackButton onBack={onBack} /><Text style={styles.detailTitle} accessibilityRole="header" numberOfLines={1}>{t("pet.manageTitle")}</Text><View style={styles.spacer} /></View>;
}
export function ShellTitleHeader({ title }: ShellTitleHeaderProps) { return <View style={styles.header}><Text style={styles.tabTitle} accessibilityRole="header" numberOfLines={1}>{title}</Text></View>; }
export function SettingsHeader() { return <View style={styles.header}><Text style={styles.tabTitle} accessibilityRole="header" numberOfLines={1}>{t("tabs.settings")}</Text></View>; }
function HeaderAction({ icon, label, primary = false, onPress }: { icon: AppIconName; label: string; primary?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.action, primary && styles.actionPrimary, pressed && (primary ? styles.actionPrimaryPressed : styles.actionPressed)]}>
      <AppIcon name={icon} size={iconSize.sm} color={primary ? colors.white : colors.pendingText} />
      <Text style={[styles.actionText, primary && styles.actionTextPrimary]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}
function BackButton({ onBack }: { onBack: () => void }) {
  const label = t("navigation.back");
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onBack} style={({ pressed }) => [styles.headerIconTouch, pressed && styles.actionPressed]}><AppIcon name="back" size={iconSize.lg - 4} color={colors.text} /></Pressable>;
}
const styles = StyleSheet.create({
  header: {
    minHeight: 64,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  tabTitle: {
    ...type.brand,
    flexShrink: 1,
  },
  detailTitle: {
    ...type.screenTitle,
    fontSize: 20,
    lineHeight: 26,
    flex: 1,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexShrink: 0,
  },
  action: {
    minHeight: layout.minTouch,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  actionPrimary: {
    backgroundColor: colors.orangePressed,
    borderColor: colors.orangePressed,
  },
  actionPressed: {
    backgroundColor: colors.surfaceWarm,
  },
  actionPrimaryPressed: {
    backgroundColor: colors.pendingText,
  },
  actionText: {
    ...type.caption,
    color: colors.pendingText,
    fontWeight: font.weight.bold,
  },
  actionTextPrimary: {
    color: colors.white,
  },
  headerIconTouch: {
    width: layout.minTouch,
    height: layout.minTouch,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  spacer: {
    width: layout.minTouch,
  },
});
