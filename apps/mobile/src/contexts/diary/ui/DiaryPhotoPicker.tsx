import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { DiaryPhotoInput } from "../domain/diaryEntry";
import { AppIcon } from "../../../design-system/iconography";
import { colors, iconSize, radius, spacing, type } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";
import { getRemainingDiaryPhotoSlots, MAX_DIARY_PHOTOS, toDiaryPhotoInputs } from "./DiaryPhotoPicker.logic";

const IMAGE_OPTIONS = {
  mediaTypes: ["images"],
  quality: 0.85,
  base64: true,
} satisfies ImagePicker.ImagePickerOptions;

export function DiaryPhotoPicker({
  photos,
  savedPhotoCount = 0,
  onChange,
  onNotice,
}: {
  photos: DiaryPhotoInput[];
  savedPhotoCount?: number;
  onChange: (photos: DiaryPhotoInput[]) => void;
  onNotice: (notice: string) => void;
}) {
  const totalPhotoCount = savedPhotoCount + photos.length;

  const canAddPhoto = () => {
    if (getRemainingDiaryPhotoSlots(totalPhotoCount) === 0) {
      onNotice(t("ko", "diary.photoLimitNotice"));
      return false;
    }
    return true;
  };

  const addFromLibrary = async () => {
    if (!canAddPhoto()) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t("ko", "diary.photoPermissionTitle"), t("ko", "diary.photoPermissionCopy"));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        ...IMAGE_OPTIONS,
        allowsMultipleSelection: true,
        selectionLimit: getRemainingDiaryPhotoSlots(totalPhotoCount),
      });

      addPickedAssets(result);
    } catch {
      onNotice(t("ko", "diary.photoLibraryFailed"));
    }
  };

  const takePhoto = async () => {
    if (!canAddPhoto()) return;

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t("ko", "diary.cameraPermissionTitle"), t("ko", "diary.cameraPermissionCopy"));
        return;
      }

      const result = await ImagePicker.launchCameraAsync(IMAGE_OPTIONS);
      addPickedAssets(result);
    } catch {
      onNotice(t("ko", "diary.photoCameraFailed"));
    }
  };

  const addPickedAssets = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;

    const nextPhotos = toDiaryPhotoInputs(result.assets, getRemainingDiaryPhotoSlots(totalPhotoCount));

    onChange([...photos, ...nextPhotos]);
    onNotice(t("ko", "diary.photoAddedNotice"));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.photoRow}>
        {photos.map((photo, index) => (
          <Pressable
            key={`${photo.uri}-${index}`}
            accessibilityRole="button"
            accessibilityLabel={t("ko", "diary.photoRemoveA11y").replace("{count}", String(index + 1))}
            style={styles.thumbButton}
            onPress={() => onChange(photos.filter((_, photoIndex) => photoIndex !== index))}
          >
            <Image source={{ uri: photo.uri }} style={styles.thumb} />
            <View style={styles.removeBadge}>
              <AppIcon name="close" size={iconSize.xs} color={colors.white} />
            </View>
          </Pressable>
        ))}
        {totalPhotoCount < MAX_DIARY_PHOTOS ? (
          <>
            <Pressable accessibilityRole="button" accessibilityLabel={t("ko", "diary.photoLibrary")} style={styles.addButton} onPress={addFromLibrary}>
              <AppIcon name="addPhoto" size={iconSize.lg} color={colors.textSoft} />
              <Text style={styles.addText}>{t("ko", "diary.photoLibrary")}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t("ko", "diary.photoCamera")} style={styles.addButton} onPress={takePhoto}>
              <AppIcon name="camera" size={iconSize.lg} color={colors.textSoft} />
              <Text style={styles.addText}>{t("ko", "diary.photoCamera")}</Text>
            </Pressable>
          </>
        ) : null}
      </View>
      <Text style={styles.count}>{totalPhotoCount}/{MAX_DIARY_PHOTOS}</Text>
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
