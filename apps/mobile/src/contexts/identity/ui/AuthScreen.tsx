import { useRef, useState, type ComponentProps } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FieldLabel, NoticeBanner, PrimaryButton, SegmentedControl } from "../../../design-system/components";
import { AppIcon, type AppIconName } from "../../../design-system/iconography";
import { colors, iconSize } from "../../../design-system/tokens";
import { t, type TranslationKey } from "../../../i18n/translations";
import { useLanguage } from "../../../i18n/languageContext";
import { useAuth } from "../application/authContext";
import { authFormValidationKey, canSubmitAuth, createAuthModeTransition, type AuthMode } from "./authFormState";
import { styles } from "./AuthScreen.styles";

export function AuthScreen() {
  const { signIn, signUp, error, authMessage, loading, resetMessage } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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

            <PasswordField
              label={t("ko", "auth.password")}
              value={password}
              onChangeText={setPassword}
              visible={showPassword}
              onToggleVisibility={() => setShowPassword((current) => !current)}
              textContentType={isSignUp ? "newPassword" : "password"}
              autoComplete={isSignUp ? "new-password" : "current-password"}
            />

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

            <PrimaryButton label={t("ko", isSignUp ? "auth.signUp" : "auth.signIn")} onPress={submit} disabled={loading} />

            {error || localError ? <NoticeBanner text={t("ko", error ?? localError!)} icon="close" tone="error" /> : null}
            {authMessage ? <NoticeBanner text={t("ko", authMessage)} icon="check" /> : null}

            {isSignUp && <Text style={styles.hint}>{t("ko", "auth.signUpHint")}</Text>}
            {loading ? <Text style={styles.notice}>{t("ko", "auth.wait")}</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PasswordField({
  label,
  value,
  onChangeText,
  visible,
  onToggleVisibility,
  textContentType,
  autoComplete,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  visible: boolean;
  onToggleVisibility: () => void;
  textContentType: ComponentProps<typeof TextInput>["textContentType"];
  autoComplete: ComponentProps<typeof TextInput>["autoComplete"];
}) {
  return (
    <View style={styles.fieldGroup}>
      <FieldLabel label={label} />
      <View style={styles.passwordRow}>
        <TextInput
          style={[styles.input, styles.passwordInput]}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType={textContentType}
          autoComplete={autoComplete}
          accessibilityLabel={label}
          placeholder={label}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("ko", visible ? "auth.hidePassword" : "auth.showPassword")}
          style={styles.eyeButton}
          onPress={onToggleVisibility}
        >
          <AppIcon name={visible ? "eyeOff" : "eye"} size={iconSize.md} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const authValueItems: { key: "auth.valueReport" | "auth.valueFamily" | "auth.valueSafeSummary"; icon: AppIconName }[] = [
  { key: "auth.valueReport", icon: "reports" },
  { key: "auth.valueFamily", icon: "care" },
  { key: "auth.valueSafeSummary", icon: "shield" },
];
