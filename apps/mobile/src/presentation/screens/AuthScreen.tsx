import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { NoticeBanner, PrimaryButton, SegmentedControl } from "../../design-system/components";
import { colors, layout, radius, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import { useAuth } from "../../contexts/identity/application/authContext";

type AuthMode = "signIn" | "signUp";

export function AuthScreen() {
  const { signIn, signUp, error, authMessage, loading, resetMessage } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const isSignUp = mode === "signUp";

  async function submit() {
    resetMessage();
    setLocalError(null);

    if (!email || !password || (isSignUp && !passwordConfirm)) {
      setLocalError("Please fill in all required fields.");
      return;
    }

    if (isSignUp && password !== passwordConfirm) {
      setLocalError("Password confirmation does not match.");
      return;
    }

    if (isSignUp) {
      await signUp(email, password);
      return;
    }

    await signIn(email, password);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("en", isSignUp ? "auth.signUpTitle" : "auth.signInTitle")}</Text>
      <Text style={styles.copy}>{t("en", "auth.copy")}</Text>

      <SegmentedControl
        items={[
          { label: t("en", "auth.signIn"), value: "signIn" },
          { label: t("en", "auth.signUp"), value: "signUp" },
        ]}
        value={mode}
        onChange={setMode}
      />

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder={t("en", "auth.email")}
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder={t("en", "auth.password")}
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
        />

        {isSignUp ? (
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder={t("en", "auth.passwordConfirm")}
            placeholderTextColor={colors.textMuted}
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
          />
        ) : null}

        <PrimaryButton label={t("en", isSignUp ? "auth.signUp" : "auth.signIn")} onPress={submit} />

      {error || localError ? <NoticeBanner text={error ?? localError ?? ""} icon="close" /> : null}
      {authMessage ? <NoticeBanner text={authMessage} icon="check" /> : null}

        {isSignUp && <Text style={styles.hint}>{t("en", "auth.signUpHint")}</Text>}
        {isSignUp && loading ? <Text style={styles.notice}>{t("en", "auth.wait")}</Text> : null}
        {!isSignUp && loading ? <Text style={styles.notice}>{t("en", "auth.wait")}</Text> : null}
      </View>
    </View>
  );
}

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
  form: {
    gap: spacing.md,
  },
  input: {
    minHeight: 52,
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
