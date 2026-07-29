import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { DangerButton, NoticeBanner, PrimaryButton, SecondaryButton, SegmentedControl, SurfaceCard } from "../../../design-system/components";
import { confirmDestructiveAction } from "../../../design-system/confirmAction";
import { AppIcon } from "../../../design-system/iconography";
import { colors, iconSize, radius, spacing, type } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";
import { useLanguage } from "../../../i18n/languageContext";
import { PRIVACY_POLICY_URL, SUPPORT_URL } from "../../../shared-kernel/config";
import { useAccountDeletion } from "../application/useAccountDeletion";
import { ChangePasswordForm } from "./ChangePasswordForm";

function openExternalUrl(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

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
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const deleting = accountDeletion.status === "deleting";

  const confirmDeleteAccount = () => {
    accountDeletion.requestConfirm();
    void confirmDestructiveAction(
      {
        title: t("settings.deleteAccountConfirmTitle"),
        message: t("settings.deleteAccountConfirmBody"),
        cancelText: t("settings.deleteAccountConfirmCancel"),
        confirmText: t("settings.deleteAccountConfirmAction"),
      },
      async () => (await accountDeletion.deleteAccount()).ok,
    ).then((confirmed) => {
      // cancel is a no-op unless the dialog was dismissed while still confirming,
      // so a failed deletion keeps its error state for the retry banner.
      if (!confirmed) accountDeletion.cancelConfirm();
    });
  };

  return (
    <View style={styles.screen}>
      <SurfaceCard>
        <View style={styles.cardBody}>
          <View style={styles.rowTitle}>
            <AppIcon name="pet" size={iconSize.md} color={colors.orangeDeep} />
            <Text style={styles.title}>{t(configured ? "settings.accountTitle" : "settings.previewTitle")}</Text>
          </View>
          <Text style={styles.copy}>{email || t("settings.previewAccount")}</Text>
          {configured
            ? <>
                <SecondaryButton
                  label={t(showPasswordChange ? "settings.changePasswordCancel" : "settings.changePassword")}
                  onPress={() => setShowPasswordChange((current) => !current)}
                />
                {showPasswordChange ? <ChangePasswordForm /> : null}
                <SecondaryButton label={t("auth.signOut")} onPress={onSignOut} />
              </>
            : <Text style={styles.copy}>{t("settings.previewCopy")}</Text>}
          {configured ? (
            <DangerButton
              label={t(deleting ? "settings.deleteAccountInProgress" : "settings.deleteAccount")}
              onPress={confirmDeleteAccount}
              disabled={deleting}
              busy={deleting}
            />
          ) : null}
          {configured && accountDeletion.status === "error" ? <NoticeBanner text={t("settings.deleteAccountError")} icon="close" tone="error" /> : null}
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.cardBody}>
          <View style={styles.rowTitle}>
            <AppIcon name="settings" size={iconSize.md} color={colors.orangeDeep} />
            <Text style={styles.title}>{t("settings.profileTitle")}</Text>
          </View>
          <Text style={styles.copy}>{t("settings.profileCopy")}</Text>
          <PrimaryButton label={t("settings.openProfiles")} icon="pet" onPress={onOpenPetProfiles} />
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.cardBody}>
          <Text style={styles.title}>{t("settings.language")}</Text>
          <SegmentedControl
            value={language}
            onChange={setLanguage}
            items={[
              { label: t("language.koNative"), value: "ko" },
              { label: t("language.enNative"), value: "en" },
            ]}
          />
          <Text style={styles.copy}>{t("settings.languageCopy")}</Text>
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.cardBody}>
          <Text style={styles.title}>{t("settings.dataTitle")}</Text>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, { backgroundColor: configured ? colors.mintDeep : colors.orange }]} />
            <Text style={styles.statusText}>{t(configured ? "settings.syncReady" : "settings.localOnly")}</Text>
          </View>
        </View>
      </SurfaceCard>

      <View style={styles.policyLinks}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t("settings.privacyPolicy")}
          style={styles.policyLink}
          onPress={() => openExternalUrl(PRIVACY_POLICY_URL)}
        >
          <Text style={styles.policyLinkText}>{t("settings.privacyPolicy")}</Text>
        </Pressable>
        <Text style={styles.policyDivider}>·</Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t("settings.support")}
          style={styles.policyLink}
          onPress={() => openExternalUrl(SUPPORT_URL)}
        >
          <Text style={styles.policyLinkText}>{t("settings.support")}</Text>
        </Pressable>
      </View>
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
  policyLinks: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  policyLink: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  policyLinkText: {
    ...type.caption,
    color: colors.textMuted,
    textDecorationLine: "underline",
  },
  policyDivider: {
    ...type.caption,
    color: colors.textSoft,
  },
});
