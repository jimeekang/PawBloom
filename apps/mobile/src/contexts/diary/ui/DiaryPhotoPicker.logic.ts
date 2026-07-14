import type { DiaryEntry, DiaryPhotoInput } from "../domain/diaryEntry";

export const MAX_DIARY_PHOTOS = 5;

type PickedPhotoAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  base64?: string | null;
};

export function getRemainingDiaryPhotoSlots(photoCount: number) {
  return Math.max(0, MAX_DIARY_PHOTOS - photoCount);
}

export function countSavedDiaryPhotosForDate(entries: DiaryEntry[], dateKey: string, fallbackEntry?: DiaryEntry | null) {
  const matchingEntries = entries.filter((entry) => entry.category === "photo" && entry.entryDate === dateKey);
  const savedCount = matchingEntries.reduce((count, entry) => count + (entry.photoCount ?? 0), 0);
  if (!fallbackEntry || fallbackEntry.category !== "photo" || fallbackEntry.entryDate !== dateKey) return savedCount;
  return matchingEntries.some((entry) => entry.id === fallbackEntry.id) ? savedCount : savedCount + (fallbackEntry.photoCount ?? 0);
}

export function toDiaryPhotoInputs(assets: PickedPhotoAsset[], remainingSlots: number): DiaryPhotoInput[] {
  return assets.slice(0, Math.max(0, remainingSlots)).map((asset) => ({
    uri: asset.uri,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
    base64: asset.base64,
  }));
}
