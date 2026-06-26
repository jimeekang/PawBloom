import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, iconSize, radius, spacing, type } from "../../design-system/tokens";
import { AppIcon } from "../../design-system/iconography";
import { t } from "../../i18n/translations";

type HomeHeaderProps = {
  petName: string;
  onPetPress: () => void;
  onManagePets: () => void;
  canSwitchPet: boolean;
};

type DiaryHeaderProps = {
  onBack: () => void;
};

type ReportsHeaderProps = {
  onSignOut: () => void;
};

export function HomeHeader({ petName, onPetPress, onManagePets, canSwitchPet }: HomeHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <AppIcon name="logo" size={34} color={colors.orange} />
        <Text style={styles.brandText}>PawBloom</Text>
      </View>
      <View style={styles.headerActions}>
        <Pressable style={[styles.petSwitch, !canSwitchPet && styles.petSwitchDisabled]} onPress={onPetPress} disabled={!canSwitchPet}>
          <AppIcon name="pet" size={iconSize.sm} color={canSwitchPet ? colors.orangeDeep : colors.textMuted} />
          <Text style={styles.petSwitchText}>{petName}</Text>
        </Pressable>
        <View style={styles.bellWrap}>
          <AppIcon name="bell" size={iconSize.lg} color={colors.text} />
          <View style={styles.notificationDot} />
        </View>
        <Pressable onPress={onManagePets} style={styles.headerIconTouch}>
          <AppIcon name="menu" size={iconSize.lg} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

export function DiaryHeader({ onBack }: DiaryHeaderProps) {
  return (
    <View style={styles.header}>
      <AppIconButton iconName="back" onPress={onBack} />
      <Text style={styles.screenTitle}>{t("en", "diary.title")}</Text>
      <AppIcon name="calendar" size={iconSize.lg} color={colors.text} />
    </View>
  );
}

export function PetSettingsHeader({ onBack }: DiaryHeaderProps) {
  return (
    <View style={styles.header}>
      <AppIconButton iconName="back" onPress={onBack} />
      <Text style={styles.screenTitle}>{t("ko", "pet.manageTitle")}</Text>
      <AppIcon name="settings" size={iconSize.lg} color={colors.text} />
    </View>
  );
}

export function CareHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.careTitleRow}>
        <View style={styles.careBadge}>
          <AppIcon name="care" size={iconSize.lg} color={colors.white} />
        </View>
        <Text style={styles.screenTitle}>{t("en", "care.eyebrow")}</Text>
      </View>
      <AppIcon name="settings" size={iconSize.lg} color={colors.text} />
    </View>
  );
}

export function ReportsHeader({ onSignOut }: ReportsHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.careTitleRow}>
        <AppIcon name="reports" size={iconSize.lg} color={colors.orangeDeep} />
        <Text style={styles.screenTitle}>{t("en", "tabs.reports")}</Text>
      </View>
      <Pressable onPress={onSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

function AppIconButton({ iconName, onPress }: { iconName: "back"; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.headerIconTouch}>
      <AppIcon name={iconName} size={iconSize.lg} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 70,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  brandText: {
    ...type.brand,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  petSwitch: {
    minHeight: 34,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  petSwitchDisabled: {
    opacity: 0.6,
  },
  petSwitchText: {
    ...type.caption,
    color: colors.text,
    fontWeight: "600",
  },
  bellWrap: {
    position: "relative",
  },
  notificationDot: {
    position: "absolute",
    top: 2,
    right: 1,
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.coral,
    borderWidth: 1,
    borderColor: colors.appBackground,
  },
  screenTitle: {
    ...type.screenTitle,
  },
  careTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  careBadge: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.salmon,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: {
    ...type.caption,
    color: colors.orangeDeep,
    fontWeight: "600",
  },
  headerIconTouch: {
    width: 44,
    height: 44,
    justifyContent: "center",
  },
});
