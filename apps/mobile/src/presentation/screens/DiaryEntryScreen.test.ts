import { isDiaryDetailPanelOpenAfterSave } from "./DiaryEntryScreen";

if (isDiaryDetailPanelOpenAfterSave(true) !== false) {
  throw new Error("diary detail panel must close after saving an entry");
}
