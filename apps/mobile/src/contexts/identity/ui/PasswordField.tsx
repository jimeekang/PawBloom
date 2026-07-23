import { type ComponentProps } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { FieldLabel } from "../../../design-system/components";
import { AppIcon } from "../../../design-system/iconography";
import { colors, iconSize } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";
import { styles } from "./AuthScreen.styles";

// Shared secure input with a visibility toggle, used by the sign-in/sign-up
// form (AuthScreen) and the recovery new-password form (PasswordRecoveryScreen).
export function PasswordField({
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
