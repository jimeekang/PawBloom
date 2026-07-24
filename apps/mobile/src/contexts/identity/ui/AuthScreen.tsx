import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
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

function openExternalUrl(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

export function AuthScreen() {
  const { signIn, signUp, requestPasswordReset, error, authMessage, loading, resetMessage } = useAuth();
  const { language, setLanguage } = useLanguage();
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
                { label: t("ko", "language.koNative"), value: "ko" },
                { label: t("ko", "language.enNative"), value: "en" },
              ]}
              value={language}
              onChange={setLanguage}
            />
          </View>
          <Text style={styles.title}>{t("ko", isReset ? "auth.resetRequestTitle" : isSignUp ? "auth.signUpTitle" : "auth.signInTitle")}</Text>
          <Text style={styles.copy}>{t("ko", isReset ? "auth.resetRequestCopy" : "auth.copy")}</Text>
          {!isReset ? (
            <>
              <View style={styles.valuePanel}>
                {authValueItems.map((item) => (
                  <View key={item.key} style={styles.valueRow}>
                    <View style={styles.valueIcon}>
                      <AppIcon name={item.icon} size={iconSize.sm} color={colors.orangeDeep} />
                    </View>
                    <Text style={styles.valueText}>{t("ko", item.key)}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.trustCopy}>{t("ko", "auth.trustCopy")}</Text>

              <SegmentedControl
                items={[
                  { label: t("ko", "auth.signIn"), value: "signIn" },
                  { label: t("ko", "auth.signUp"), value: "signUp" },
                ]}
                value={mode}
                onChange={changeMode}
              />
            </>
          ) : null}

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <FieldLabel label={t("ko", "auth.email")} />
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                accessibilityLabel={t("ko", "auth.email")}
                placeholder={t("ko", "auth.email")}
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {!isReset ? (
              <PasswordField
                label={t("ko", "auth.password")}
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
                label={t("ko", "auth.passwordConfirm")}
                value={passwordConfirm}
                onChangeText={setPasswordConfirm}
                visible={showPassword}
                onToggleVisibility={() => setShowPassword((current) => !current)}
                textContentType="newPassword"
                autoComplete="new-password"
              />
            ) : null}

            <PrimaryButton label={t("ko", isReset ? "auth.sendResetLink" : isSignUp ? "auth.signUp" : "auth.signIn")} onPress={submit} disabled={loading} />

            {mode === "signIn" ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("ko", "auth.forgotPassword")}
                style={styles.textLink}
                onPress={() => changeMode("resetRequest")}
              >
                <Text style={styles.textLinkText}>{t("ko", "auth.forgotPassword")}</Text>
              </Pressable>
            ) : null}
            {isReset ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("ko", "auth.backToSignIn")}
                style={styles.textLink}
                onPress={() => changeMode("signIn")}
              >
                <Text style={styles.textLinkText}>{t("ko", "auth.backToSignIn")}</Text>
              </Pressable>
            ) : null}

            {error || localError ? <NoticeBanner text={t("ko", error ?? localError!)} icon="close" tone="error" /> : null}
            {authMessage ? (
              <NoticeBanner
                text={t("ko", authMessage)}
                icon={authMessage === "auth.sessionExpired" ? "close" : authMessage === "auth.checkEmail" || authMessage === "auth.resetEmailSent" ? "shield" : "check"}
                tone={authMessage === "auth.sessionExpired" ? "error" : authMessage === "auth.checkEmail" || authMessage === "auth.resetEmailSent" ? "progress" : "success"}
              />
            ) : null}

            {isSignUp && <Text style={styles.hint}>{t("ko", "auth.signUpHint")}</Text>}
            {loading ? <Text style={styles.notice}>{t("ko", "auth.wait")}</Text> : null}

            <View style={styles.policyLinks}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t("ko", "settings.privacyPolicy")}
                style={styles.policyLink}
                onPress={() => openExternalUrl(PRIVACY_POLICY_URL)}
              >
                <Text style={styles.policyLinkText}>{t("ko", "settings.privacyPolicy")}</Text>
              </Pressable>
              <Text style={styles.policyDivider}>·</Text>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t("ko", "settings.support")}
                style={styles.policyLink}
                onPress={() => openExternalUrl(SUPPORT_URL)}
              >
                <Text style={styles.policyLinkText}>{t("ko", "settings.support")}</Text>
              </Pressable>
            </View>
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
