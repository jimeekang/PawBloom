import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, font, iconSize, layout, radius, spacing, type } from "../../design-system/tokens";
import { AppIcon } from "../../design-system/iconography";
import { t } from "../../i18n/translations";

type HomeHeaderProps = {
  petName: string;
  onPetPress: () => void;
  canSwitchPet: boolean;
};

type BackHeaderProps = {
  onBack: () => void;
};

export function HomeHeader({ petName, onPetPress, canSwitchPet }: HomeHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <AppIcon name="logo" size={34} color={colors.orange} />
        <Text style={styles.brandText}>PawBloom</Text>
      </View>
      <View style={styles.headerActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t("ko", "pet.selectTitle")}: ${petName}`}
          accessibilityState={{ disabled: !canSwitchPet }}
          hitSlop={6}
          style={({ pressed }) => [styles.petSwitch, pressed && canSwitchPet && styles.petSwitchPressed, !canSwitchPet && styles.petSwitchDisabled]}
          onPress={onPetPress}
          disabled={!canSwitchPet}
        >
          <AppIcon name="pet" size={iconSize.sm} color={canSwitchPet ? colors.orangeDeep : colors.textMuted} />
          <Text style={styles.petSwitchText}>{petName}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function DiaryHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.careTitleRow}>
        <AppIcon name="diary" size={iconSize.lg} color={colors.orangeDeep} />
        <Text style={styles.screenTitle}>{t("ko", "tabs.diary")}</Text>
      </View>
      <View style={styles.headerSpacer} />
    </View>
  );
}

export function PetSettingsHeader({ onBack }: BackHeaderProps) {
  return (
    <View style={styles.header}>
      <AppIconButton iconName="back" label={t("ko", "navigation.back")} onPress={onBack} />
      <Text style={styles.screenTitle}>{t("ko", "pet.manageTitle")}</Text>
      <View style={styles.headerSpacer}>
        <AppIcon name="pet" size={iconSize.md} color={colors.textSoft} />
      </View>
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
        <Text style={styles.screenTitle}>{t("ko", "care.eyebrow")}</Text>
      </View>
      <View style={styles.headerSpacer} />
    </View>
  );
}

export function ReportsHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.careTitleRow}>
        <AppIcon name="reports" size={iconSize.lg} color={colors.orangeDeep} />
        <Text style={styles.screenTitle}>{t("ko", "tabs.reports")}</Text>
      </View>
      <View style={styles.headerSpacer} />
    </View>
  );
}

export function SettingsHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.careTitleRow}>
        <AppIcon name="settings" size={iconSize.lg} color={colors.orangeDeep} />
        <Text style={styles.screenTitle}>{t("ko", "tabs.settings")}</Text>
      </View>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function AppIconButton({ iconName, label, onPress }: { iconName: "back"; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.headerIconTouch, pressed && styles.headerIconTouchPressed]}>
      <AppIcon name={iconName} size={iconSize.lg} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 70,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
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
    gap: spacing.md,
  },
  petSwitch: {
    minHeight: 38,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  petSwitchPressed: {
    backgroundColor: colors.surfaceWarm,
  },
  petSwitchDisabled: {
    opacity: 0.6,
  },
  petSwitchText: {
    ...type.caption,
    color: colors.text,
    fontWeight: font.weight.semibold,
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
  headerIconTouch: {
    width: 44,
    height: 44,
    justifyContent: "center",
  },
  headerIconTouchPressed: {
    opacity: 0.6,
  },
  headerSpacer: {
    width: 44,
    height: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
});
