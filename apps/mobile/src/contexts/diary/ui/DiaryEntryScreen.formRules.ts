import type { DiaryCategory, DiaryDetailInput, DiaryPhotoInput } from "../domain/diaryEntry";

const structuredCategories = new Set<DiaryCategory>(["food", "water", "walk", "stool", "condition"]);

export function getDiaryCategoryFormState(category: DiaryCategory) {
  return {
    showsDetail: structuredCategories.has(category),
    showsMemo: category === "memo",
    showsPhotos: category === "photo",
  };
}

export function getDiaryDetailForSave(category: DiaryCategory, detail: DiaryDetailInput) {
  return structuredCategories.has(category) && detail.category === category ? detail : undefined;
}

export function getDiarySummaryForSave(category: DiaryCategory, memo: string) {
  return category === "memo" || category === "photo" ? memo.trim() : "";
}

export function getDiaryPhotosForSave(category: DiaryCategory, photos: DiaryPhotoInput[], isEditing: boolean) {
  return category === "photo" && !isEditing ? photos : undefined;
}
