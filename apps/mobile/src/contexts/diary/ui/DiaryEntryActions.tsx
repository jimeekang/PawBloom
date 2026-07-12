import { Pressable, Text, View } from "react-native";
import { NoticeBanner, PrimaryButton, SecondaryButton } from "../../../design-system/components";
import { AppIcon } from "../../../design-system/iconography";
import { colors, iconSize } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";
import { styles } from "./DiaryEntryScreen.styles";

type Props = {
  editing: boolean;
  isSaving: boolean;
  saveBlockedByRole: boolean;
  canDelete: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
};

export function DiaryEntryActions({ editing, isSaving, saveBlockedByRole, canDelete, onSave, onCancel, onDelete }: Props) {
  return (
    <View style={styles.actionStack}>
      {saveBlockedByRole ? <NoticeBanner text={t("ko", "permission.diaryUpdateCareTeamOnly")} icon="shield" /> : null}
      <PrimaryButton label={editing ? t("ko", "diary.update") : t("ko", "diary.save")} onPress={onSave} disabled={isSaving || saveBlockedByRole} />
      {editing ? <SecondaryButton label={t("ko", "diary.cancelEdit")} onPress={onCancel} disabled={isSaving} /> : null}
      {editing && canDelete ? (
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: isSaving }} disabled={isSaving} style={styles.dangerButton} onPress={onDelete}>
          <AppIcon name="close" size={iconSize.sm} color={colors.coral} />
          <Text style={styles.dangerButtonText}>{t("ko", "diary.delete")}</Text>
        </Pressable>
      ) : null}
      {editing && !canDelete ? <NoticeBanner text={t("ko", "permission.diaryDeleteOwnerOnly")} icon="shield" /> : null}
    </View>
  );
}
