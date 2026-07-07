import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { DiaryPhotoInput } from "../domain/diaryEntry";
import { AppIcon } from "../../../design-system/iconography";
import { colors, iconSize, radius, spacing, type } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";

const MAX_PHOTOS = 5;

export function DiaryPhotoPicker({
  photos,
  onChange,
  onNotice,
}: {
  photos: DiaryPhotoInput[];
  onChange: (photos: DiaryPhotoInput[]) => void;
  onNotice: (notice: string) => void;
}) {
  const addPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      onNotice(t("ko", "diary.photoLimitNotice"));
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("ko", "diary.photoPermissionTitle"), t("ko", "diary.photoPermissionCopy"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.85,
      base64: true,
    });

    if (result.canceled) {
      return;
    }

    const nextPhotos = result.assets.slice(0, MAX_PHOTOS - photos.length).map((asset) => ({
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      base64: asset.base64,
    }));

    onChange([...photos, ...nextPhotos]);
    onNotice(t("ko", "diary.photoAddedNotice"));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.photoRow}>
        {photos.map((photo, index) => (
          <Pressable key={`${photo.uri}-${index}`} style={styles.thumbButton} onPress={() => onChange(photos.filter((_, photoIndex) => photoIndex !== index))}>
            <Image source={{ uri: photo.uri }} style={styles.thumb} />
            <View style={styles.removeBadge}>
              <AppIcon name="close" size={iconSize.xs} color={colors.white} />
            </View>
          </Pressable>
        ))}
        {photos.length < MAX_PHOTOS ? (
          <Pressable style={styles.addButton} onPress={addPhoto}>
            <AppIcon name="addPhoto" size={iconSize.lg} color={colors.textSoft} />
            <Text style={styles.addText}>{t("ko", "diary.photoAdd")}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.count}>{photos.length}/{MAX_PHOTOS}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  photoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  thumbButton: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
  },
  thumb: {
    width: "100%",
    height: "100%",
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  removeBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.coral,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    width: 116,
    height: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderDashed,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  addText: {
    ...type.caption,
    color: colors.textMuted,
  },
  count: {
    ...type.caption,
    textAlign: "right",
  },
});
