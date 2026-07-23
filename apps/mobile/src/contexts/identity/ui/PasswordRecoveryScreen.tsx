import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NoticeBanner, PrimaryButton } from "../../../design-system/components";
import { t, type TranslationKey } from "../../../i18n/translations";
import { useAuth } from "../application/authContext";
import { canSubmitAuth } from "./authFormState";
import { PasswordField } from "./PasswordField";
import { styles } from "./AuthScreen.styles";

// Shown by the app gate while a password-recovery deep link session is active.
// Saving a new password (or skipping) returns the user to the signed-in app.
export function PasswordRecoveryScreen() {
  const { updatePassword, cancelPasswordRecovery, error, loading, resetMessage } = useAuth();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<TranslationKey | null>(null);
  const [done, setDone] = useState(false);
  const submissionInFlight = useRef(false);

  async function submit() {
    if (!canSubmitAuth(loading, submissionInFlight.current)) return;
    resetMessage();
    setLocalError(null);

    if (!password || !passwordConfirm) {
      setLocalError("auth.requiredFields");
      return;
    }
    if (password !== passwordConfirm) {
      setLocalError("auth.passwordMismatch");
      return;
    }

    submissionInFlight.current = true;
    try {
      const failureKey = await updatePassword(password);
      if (failureKey === null) setDone(true);
    } finally {
      submissionInFlight.current = false;
    }
  }

  if (done) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{t("ko", "auth.newPasswordTitle")}</Text>
          <NoticeBanner text={t("ko", "auth.resetDone")} icon="check" />
          <PrimaryButton label={t("ko", "auth.resetContinue")} onPress={cancelPasswordRecovery} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{t("ko", "auth.newPasswordTitle")}</Text>
          <Text style={styles.copy}>{t("ko", "auth.newPasswordCopy")}</Text>

          <PasswordField
            label={t("ko", "auth.newPassword")}
            value={password}
            onChangeText={setPassword}
            visible={showPassword}
            onToggleVisibility={() => setShowPassword((current) => !current)}
            textContentType="newPassword"
            autoComplete="new-password"
          />
          <PasswordField
            label={t("ko", "auth.passwordConfirm")}
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            visible={showPassword}
            onToggleVisibility={() => setShowPassword((current) => !current)}
            textContentType="newPassword"
            autoComplete="new-password"
          />

          <PrimaryButton label={t("ko", "auth.newPasswordTitle")} onPress={submit} disabled={loading} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("ko", "auth.resetLater")}
            style={styles.textLink}
            onPress={cancelPasswordRecovery}
          >
            <Text style={styles.textLinkText}>{t("ko", "auth.resetLater")}</Text>
          </Pressable>

          {error || localError ? <NoticeBanner text={t("ko", error ?? localError!)} icon="close" tone="error" /> : null}
          {loading ? <Text style={styles.notice}>{t("ko", "auth.wait")}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
