import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { NoticeBanner, PrimaryButton, SecondaryButton, SegmentedControl, SurfaceCard } from "../../../design-system/components";
import { AppIcon } from "../../../design-system/iconography";
import { colors, iconSize, layout, radius, spacing, type } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";
import { useLanguage } from "../../../i18n/languageContext";
import { useAccountDeletion } from "../application/useAccountDeletion";

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
  const accountDeletion = useAccountDeletion();
  const deleting = accountDeletion.status === "deleting";

  const confirmDeleteAccount = () => {
    accountDeletion.requestConfirm();
    Alert.alert(
      t("ko", "settings.deleteAccountConfirmTitle"),
      t("ko", "settings.deleteAccountConfirmBody"),
      [
        { text: t("ko", "settings.deleteAccountConfirmCancel"), style: "cancel", onPress: accountDeletion.cancelConfirm },
        { text: t("ko", "settings.deleteAccountConfirmAction"), style: "destructive", onPress: () => void accountDeletion.deleteAccount() },
      ],
      { cancelable: true, onDismiss: accountDeletion.cancelConfirm },
    );
  };

  return (
    <View style={styles.screen}>
      <SurfaceCard>
        <View style={styles.cardBody}>
          <View style={styles.rowTitle}>
            <AppIcon name="pet" size={iconSize.md} color={colors.orangeDeep} />
            <Text style={styles.title}>{t("ko", "settings.accountTitle")}</Text>
          </View>
          <Text style={styles.copy}>{email || t("ko", "settings.previewAccount")}</Text>
          <SecondaryButton label={t("ko", "auth.signOut")} onPress={onSignOut} />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: deleting }}
            disabled={deleting}
            style={({ pressed }) => [styles.deleteButton, pressed && !deleting && styles.deleteButtonPressed, deleting && styles.deleteButtonDisabled]}
            onPress={confirmDeleteAccount}
          >
            <Text style={styles.deleteButtonText}>{t("ko", "settings.deleteAccount")}</Text>
          </Pressable>
          {accountDeletion.status === "error" ? <NoticeBanner text={t("ko", "settings.deleteAccountError")} icon="close" tone="error" /> : null}
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

      {__DEV__ ? (
        <SurfaceCard>
          <View style={styles.cardBody}>
            <Text style={styles.title}>{t("ko", "settings.environment")}</Text>
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, { backgroundColor: configured ? colors.mintDeep : colors.coral }]} />
              <Text style={styles.statusText}>{configured ? t("ko", "settings.supabaseReady") : t("ko", "settings.supabaseMissing")}</Text>
            </View>
            <Text style={styles.copy}>{t("ko", "settings.plan")}: {t("ko", "settings.freePlan")}</Text>
          </View>
        </SurfaceCard>
      ) : null}
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
  deleteButton: {
    minHeight: layout.buttonHeight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerBg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  deleteButtonPressed: {
    backgroundColor: colors.surfacePeach,
  },
  deleteButtonDisabled: {
    opacity: 0.55,
  },
  deleteButtonText: {
    ...type.bodyStrong,
    color: colors.danger,
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
