import { StyleSheet, Text, View } from "react-native";
import { PrimaryButton, SecondaryButton, SegmentedControl, SurfaceCard } from "../../../design-system/components";
import { AppIcon } from "../../../design-system/iconography";
import { colors, iconSize, radius, spacing, type } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";
import { useLanguage } from "../../../i18n/languageContext";

export function SettingsScreen({
  email,
  configured,
  onOpenPetProfiles,
  onSignOut,
}: {
  email?: string;
  configured: boolean;
  onOpenPetProfiles: () => void;
  onSignOut: () => void;
}) {
  const { language, setLanguage } = useLanguage();

  return (
    <View style={styles.screen}>
      <SurfaceCard>
        <View style={styles.cardBody}>
          <View style={styles.rowTitle}>
            <AppIcon name="pet" size={iconSize.md} color={colors.orangeDeep} />
            <Text style={styles.title}>{t("ko", configured ? "settings.accountTitle" : "settings.previewTitle")}</Text>
          </View>
          <Text style={styles.copy}>{email || t("ko", "settings.previewAccount")}</Text>
          {configured
            ? <SecondaryButton label={t("ko", "auth.signOut")} onPress={onSignOut} />
            : <Text style={styles.copy}>{t("ko", "settings.previewCopy")}</Text>}
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.cardBody}>
          <View style={styles.rowTitle}>
            <AppIcon name="settings" size={iconSize.md} color={colors.orangeDeep} />
            <Text style={styles.title}>{t("ko", "settings.profileTitle")}</Text>
          </View>
          <Text style={styles.copy}>{t("ko", "settings.profileCopy")}</Text>
          <PrimaryButton label={t("ko", "settings.openProfiles")} icon="pet" onPress={onOpenPetProfiles} />
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.cardBody}>
          <Text style={styles.title}>{t("ko", "settings.language")}</Text>
          <SegmentedControl
            value={language}
            onChange={setLanguage}
            items={[
              { label: t("ko", "settings.languageKo"), value: "ko" },
              { label: t("ko", "settings.languageEn"), value: "en" },
            ]}
          />
          <Text style={styles.copy}>{t("ko", "settings.languageCopy")}</Text>
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.cardBody}>
          <Text style={styles.title}>{t("ko", "settings.dataTitle")}</Text>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, { backgroundColor: configured ? colors.mintDeep : colors.orange }]} />
            <Text style={styles.statusText}>{t("ko", configured ? "settings.syncReady" : "settings.localOnly")}</Text>
          </View>
        </View>
      </SurfaceCard>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.lg,
  },
  cardBody: {
    gap: spacing.md,
  },
  rowTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    ...type.sectionTitle,
  },
  copy: {
    ...type.body,
    color: colors.textMuted,
  },
  statusPill: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
  },
  statusText: {
    ...type.caption,
    color: colors.text,
    flex: 1,
  },
});
