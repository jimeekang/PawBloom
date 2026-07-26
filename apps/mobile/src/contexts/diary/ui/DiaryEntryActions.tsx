import { Pressable, Text, View } from "react-native";
import { DangerButton, NoticeBanner, PrimaryButton, SecondaryButton } from "../../../design-system/components";
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
      {saveBlockedByRole ? <NoticeBanner text={t("permission.diaryUpdateCareTeamOnly")} icon="shield" /> : null}
      <PrimaryButton label={editing ? t("diary.update") : t("diary.save")} onPress={onSave} disabled={isSaving || saveBlockedByRole} />
      {editing ? <SecondaryButton label={t("diary.cancelEdit")} onPress={onCancel} disabled={isSaving} /> : null}
      {editing && canDelete ? (
        <DangerButton label={t("diary.delete")} icon="close" onPress={onDelete} disabled={isSaving} />
      ) : null}
      {editing && !canDelete ? <NoticeBanner text={t("permission.diaryDeleteOwnerOnly")} icon="shield" /> : null}
    </View>
  );
}
