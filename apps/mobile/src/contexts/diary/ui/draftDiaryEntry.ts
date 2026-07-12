import type { DiaryCategory, DiaryDetailInput, DiaryPhotoInput, DiaryRecordOrigin } from "../domain/diaryEntry";
import type { UUID } from "../../../shared-kernel/types";

export type DraftDiaryEntry = {
  category: DiaryCategory;
  summary: string;
  entryDate?: string;
  occurredAt: string;
  origin?: DiaryRecordOrigin;
  detail?: DiaryDetailInput;
  conditionScore?: 1 | 2 | 3 | 4 | 5;
  photos?: DiaryPhotoInput[];
  clientMutationId?: UUID;
};
