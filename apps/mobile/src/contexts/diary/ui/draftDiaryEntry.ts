import type { DiaryCategory, DiaryDetailInput, DiaryPhotoInput, DiaryRecordOrigin } from "../domain/diaryEntry";

export type DraftDiaryEntry = {
  category: DiaryCategory;
  summary: string;
  entryDate?: string;
  occurredAt: string;
  origin?: DiaryRecordOrigin;
  detail?: DiaryDetailInput;
  conditionScore?: 1 | 2 | 3 | 4 | 5;
  photos?: DiaryPhotoInput[];
};
