import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { NoticeBanner, PrimaryButton } from "../../../design-system/components";
import { spacing } from "../../../design-system/tokens";
import { t, type TranslationKey } from "../../../i18n/translations";
import { useAuth } from "../application/authContext";
import { canSubmitAuth } from "./authFormState";
import { PasswordField } from "./PasswordField";

export function ChangePasswordForm() {
  const { changePassword, loading, resetMessage } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [feedback, setFeedback] = useState<{ key: TranslationKey; tone: "error" | "success" } | null>(null);
  const submissionInFlight = useRef(false);

  async function submit() {
    if (!canSubmitAuth(loading, submissionInFlight.current)) return;
    resetMessage();
    setFeedback(null);

    if (!currentPassword || !newPassword || !passwordConfirm) {
      setFeedback({ key: "auth.requiredFields", tone: "error" });
      return;
    }
    if (newPassword !== passwordConfirm) {
      setFeedback({ key: "auth.passwordMismatch", tone: "error" });
      return;
    }

    submissionInFlight.current = true;
    try {
      const failureKey = await changePassword(currentPassword, newPassword);
      if (failureKey) {
        setFeedback({ key: failureKey, tone: "error" });
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setPasswordConfirm("");
      setFeedback({ key: "settings.passwordChanged", tone: "success" });
    } finally {
      submissionInFlight.current = false;
    }
  }

  return (
    <View style={styles.form}>
      <PasswordField
        label={t("settings.currentPassword")}
        value={currentPassword}
        onChangeText={setCurrentPassword}
        visible={showCurrentPassword}
        onToggleVisibility={() => setShowCurrentPassword((current) => !current)}
        textContentType="password"
        autoComplete="current-password"
      />
      <PasswordField
        label={t("auth.newPassword")}
        value={newPassword}
        onChangeText={setNewPassword}
        visible={showNewPassword}
        onToggleVisibility={() => setShowNewPassword((current) => !current)}
        textContentType="newPassword"
        autoComplete="new-password"
      />
      <PasswordField
        label={t("auth.passwordConfirm")}
        value={passwordConfirm}
        onChangeText={setPasswordConfirm}
        visible={showNewPassword}
        onToggleVisibility={() => setShowNewPassword((current) => !current)}
        textContentType="newPassword"
        autoComplete="new-password"
      />
      <PrimaryButton label={t("settings.changePasswordSubmit")} onPress={submit} disabled={loading} />
      {feedback ? <NoticeBanner text={t(feedback.key)} icon={feedback.tone === "success" ? "check" : "close"} tone={feedback.tone} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
  },
});
