import { Text } from "react-native";
import type { DiaryEntry, DiaryPhotoInput } from "../domain/diaryEntry";
import { t } from "../../../i18n/translations";
import { DiaryPhotoPicker } from "./DiaryPhotoPicker";
import { styles } from "./DiaryEntryScreen.styles";

type Props = {
  editingEntry: DiaryEntry | null;
  photos: DiaryPhotoInput[];
  onChange: (photos: DiaryPhotoInput[]) => void;
  onNotice: (notice: string) => void;
};

export function DiaryPhotoSection({ editingEntry, photos, onChange, onNotice }: Props) {
  return (
    <>
      <Text style={styles.sectionTitle}>{editingEntry ? t("ko", "diary.photos") : t("ko", "diary.addPhotos")}</Text>
      {editingEntry
        ? <Text style={styles.photoEditNotice}>{formatExistingPhotoNotice(editingEntry.photoCount)}</Text>
        : <DiaryPhotoPicker photos={photos} onChange={onChange} onNotice={onNotice} />}
    </>
  );
}

function formatExistingPhotoNotice(photoCount?: number) {
  return photoCount
    ? t("ko", "diary.existingPhotoCount").replace("{count}", String(photoCount))
    : t("ko", "diary.photosUnchanged");
}
