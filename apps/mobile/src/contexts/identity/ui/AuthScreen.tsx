import { useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { NoticeBanner, PrimaryButton, SegmentedControl } from "../../../design-system/components";
import { AppIcon, type AppIconName } from "../../../design-system/iconography";
import { colors, iconSize, layout, radius, spacing, type } from "../../../design-system/tokens";
import { t, type TranslationKey } from "../../../i18n/translations";
import { useAuth } from "../application/authContext";
import { authFormValidationKey, canSubmitAuth, createAuthModeTransition, type AuthMode } from "./authFormState";

export function AuthScreen() {
  const { signIn, signUp, error, authMessage, loading, resetMessage } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [localError, setLocalError] = useState<TranslationKey | null>(null);
  const submissionInFlight = useRef(false);
  const isSignUp = mode === "signUp";

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
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("ko", isSignUp ? "auth.signUpTitle" : "auth.signInTitle")}</Text>
      <Text style={styles.copy}>{t("ko", "auth.copy")}</Text>
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

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder={t("ko", "auth.email")}
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder={t("ko", "auth.password")}
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
        />

        {isSignUp ? (
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder={t("ko", "auth.passwordConfirm")}
            placeholderTextColor={colors.textMuted}
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
          />
        ) : null}

        <PrimaryButton label={t("ko", isSignUp ? "auth.signUp" : "auth.signIn")} onPress={submit} disabled={loading} />

        {error || localError ? <NoticeBanner text={t("ko", error ?? localError!)} icon="close" tone="error" /> : null}
        {authMessage ? <NoticeBanner text={t("ko", authMessage)} icon="check" /> : null}

        {isSignUp && <Text style={styles.hint}>{t("ko", "auth.signUpHint")}</Text>}
        {isSignUp && loading ? <Text style={styles.notice}>{t("ko", "auth.wait")}</Text> : null}
        {!isSignUp && loading ? <Text style={styles.notice}>{t("ko", "auth.wait")}</Text> : null}
      </View>
    </View>
  );
}

const authValueItems: { key: "auth.valueReport" | "auth.valueFamily" | "auth.valueSafeSummary"; icon: AppIconName }[] = [
  { key: "auth.valueReport", icon: "reports" },
  { key: "auth.valueFamily", icon: "care" },
  { key: "auth.valueSafeSummary", icon: "shield" },
];

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: layout.screenPadding,
    justifyContent: "center",
    gap: spacing.lg,
    backgroundColor: colors.appBackground,
  },
  title: {
    ...type.heroTitle,
    color: colors.text,
  },
  copy: {
    ...type.body,
    color: colors.text,
  },
  valuePanel: {
    gap: spacing.sm,
  },
  valueRow: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  valueIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.surfacePeach,
    alignItems: "center",
    justifyContent: "center",
  },
  valueText: {
    ...type.bodyStrong,
    flex: 1,
  },
  trustCopy: {
    ...type.caption,
    color: colors.textMuted,
  },
  form: {
    gap: spacing.md,
  },
  input: {
    minHeight: layout.inputHeight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
  },
  hint: {
    ...type.caption,
    color: colors.textMuted,
  },
  notice: {
    ...type.caption,
    color: colors.orangeDeep,
  },
});
