import { Image, StyleSheet, Text, View } from "react-native";
import type { DiaryEntry, DiaryPhotoInput } from "../domain/diaryEntry";
import { t } from "../../../i18n/translations";
import { DiaryPhotoPicker } from "./DiaryPhotoPicker";
import { styles } from "./DiaryEntryScreen.styles";
import { colors, radius, spacing } from "../../../design-system/tokens";

type Props = {
  editingEntry: DiaryEntry | null;
  savedPhotoCount: number;
  photos: DiaryPhotoInput[];
  onChange: (photos: DiaryPhotoInput[]) => void;
  onNotice: (notice: string) => void;
};

export function DiaryPhotoSection({ editingEntry, savedPhotoCount, photos, onChange, onNotice }: Props) {
  return (
    <>
      <Text style={styles.sectionTitle}>{editingEntry ? t("ko", "diary.photos") : t("ko", "diary.addPhotos")}</Text>
      {editingEntry ? (
        <>
          <Text style={styles.photoEditNotice}>{formatExistingPhotoNotice(editingEntry.photoCount)}</Text>
          {editingEntry.photoUrls?.length ? (
            <View style={photoStyles.existingRow}>
              {editingEntry.photoUrls.map((photoUrl) => <Image key={photoUrl} source={{ uri: photoUrl }} style={photoStyles.existingPhoto} />)}
            </View>
          ) : null}
        </>
      ) : null}
      <DiaryPhotoPicker
        photos={photos}
        savedPhotoCount={savedPhotoCount}
        onChange={onChange}
        onNotice={onNotice}
      />
    </>
  );
}

const photoStyles = StyleSheet.create({
  existingRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  existingPhoto: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
});

function formatExistingPhotoNotice(photoCount?: number) {
  return photoCount
    ? t("ko", "diary.existingPhotoCount").replace("{count}", String(photoCount))
    : t("ko", "diary.photosUnchanged");
}
