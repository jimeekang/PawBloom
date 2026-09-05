import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FieldLabel, NoticeBanner, PrimaryButton, SegmentedControl } from "../../../design-system/components";
import { AppIcon, type AppIconName } from "../../../design-system/iconography";
import { colors, iconSize } from "../../../design-system/tokens";
import { t, type TranslationKey } from "../../../i18n/translations";
import { useLanguage } from "../../../i18n/languageContext";
import { PRIVACY_POLICY_URL, SUPPORT_URL } from "../../../shared-kernel/config";
import { useAuth } from "../application/authContext";
import { authFormValidationKey, canSubmitAuth, createAuthModeTransition, type AuthMode } from "./authFormState";
import { PasswordField } from "./PasswordField";
import { styles } from "./AuthScreen.styles";

import { usePolicyLinks } from "./usePolicyLinks";

export function AuthScreen() {
  const { signIn, signUp, requestPasswordReset, error, authMessage, loading, resetMessage } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { failedUrl, openExternalUrl } = usePolicyLinks();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<TranslationKey | null>(null);
  const submissionInFlight = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const isSignUp = mode === "signUp";
  const isReset = mode === "resetRequest";

  useEffect(() => {
    if (!error && !localError && !authMessage) return;
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 0);
    return () => clearTimeout(timer);
  }, [authMessage, error, localError]);

  async function submit() {
    if (!canSubmitAuth(loading, submissionInFlight.current)) return;
    resetMessage();
    setLocalError(null);

    const validationKey = authFormValidationKey({ mode, email, password, passwordConfirm });
    if (validationKey) {
      setLocalError(validationKey);
      return;
    }

    submissionInFlight.current = true;
    try {
      if (isReset) {
        await requestPasswordReset(email);
        return;
      }

      if (isSignUp) {
        await signUp(email, password);
        return;
      }

      await signIn(email, password);
    } finally {
      submissionInFlight.current = false;
    }
  }

  function changeMode(nextMode: AuthMode) {
    const next = createAuthModeTransition(nextMode);
    setMode(next.mode);
    setLocalError(next.localError);
    setPasswordConfirm(next.passwordConfirm);
    resetMessage();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.langRow}>
            <SegmentedControl
              items={[
                { label: t("language.koNative"), value: "ko" },
                { label: t("language.enNative"), value: "en" },
              ]}
              value={language}
              onChange={setLanguage}
            />
          </View>
          <Text style={styles.title}>{t(isReset ? "auth.resetRequestTitle" : isSignUp ? "auth.signUpTitle" : "auth.signInTitle")}</Text>
          <Text style={styles.copy}>{t(isReset ? "auth.resetRequestCopy" : "auth.copy")}</Text>
          {!isReset ? (
            <>
              <View style={styles.valuePanel}>
                {authValueItems.map((item) => (
                  <View key={item.key} style={styles.valueRow}>
                    <View style={styles.valueIcon}>
                      <AppIcon name={item.icon} size={iconSize.sm} color={colors.orangeDeep} />
                    </View>
                    <Text style={styles.valueText}>{t(item.key)}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.trustCopy}>{t("auth.trustCopy")}</Text>

              <SegmentedControl
                items={[
                  { label: t("auth.signIn"), value: "signIn" },
                  { label: t("auth.signUp"), value: "signUp" },
                ]}
                value={mode}
                onChange={changeMode}
              />
            </>
          ) : null}

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <FieldLabel label={t("auth.email")} />
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                accessibilityLabel={t("auth.email")}
                placeholder={t("auth.email")}
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {!isReset ? (
              <PasswordField
                label={t("auth.password")}
                value={password}
                onChangeText={setPassword}
                visible={showPassword}
                onToggleVisibility={() => setShowPassword((current) => !current)}
                textContentType={isSignUp ? "newPassword" : "password"}
                autoComplete={isSignUp ? "new-password" : "current-password"}
              />
            ) : null}

            {isSignUp ? (
              <PasswordField
                label={t("auth.passwordConfirm")}
                value={passwordConfirm}
                onChangeText={setPasswordConfirm}
                visible={showPassword}
                onToggleVisibility={() => setShowPassword((current) => !current)}
                textContentType="newPassword"
                autoComplete="new-password"
              />
            ) : null}

            <PrimaryButton label={t(isReset ? "auth.sendResetLink" : isSignUp ? "auth.signUp" : "auth.signIn")} onPress={submit} disabled={loading} />

            {mode === "signIn" ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("auth.forgotPassword")}
                style={styles.textLink}
                onPress={() => changeMode("resetRequest")}
              >
                <Text style={styles.textLinkText}>{t("auth.forgotPassword")}</Text>
              </Pressable>
            ) : null}
            {isReset ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("auth.backToSignIn")}
                style={styles.textLink}
                onPress={() => changeMode("signIn")}
              >
                <Text style={styles.textLinkText}>{t("auth.backToSignIn")}</Text>
              </Pressable>
            ) : null}

            {error || localError ? <NoticeBanner text={t(error ?? localError!)} icon="close" tone="error" /> : null}
            {authMessage ? (
              <NoticeBanner
                text={t(authMessage)}
                icon={authMessage === "auth.sessionExpired" ? "close" : authMessage === "auth.checkEmail" || authMessage === "auth.resetEmailSent" ? "shield" : "check"}
                tone={authMessage === "auth.sessionExpired" ? "error" : authMessage === "auth.checkEmail" || authMessage === "auth.resetEmailSent" ? "progress" : "success"}
              />
            ) : null}

            {isSignUp && <Text style={styles.hint}>{t("auth.signUpHint")}</Text>}
            {loading ? <Text style={styles.notice}>{t("auth.wait")}</Text> : null}

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
            {failedUrl ? <NoticeBanner text={t("settings.linkOpenFailed").replace("{url}", failedUrl)} icon="close" tone="error" /> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const authValueItems: { key: "auth.valueReport" | "auth.valueFamily" | "auth.valueSafeSummary"; icon: AppIconName }[] = [
  { key: "auth.valueReport", icon: "reports" },
  { key: "auth.valueFamily", icon: "care" },
  { key: "auth.valueSafeSummary", icon: "shield" },
];
