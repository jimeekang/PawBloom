import { setRuntimeLanguage } from "../../../i18n/translations";
import { getDiaryEntryDisplaySummary } from "./diaryEntryDisplay";

setRuntimeLanguage("en");
if (getDiaryEntryDisplaySummary({ category: "food", summary: "식사 체크리스트가 기록되었습니다." }) !== "Food") {
  throw new Error("English display must localize a legacy Korean default diary summary from its category");
}

setRuntimeLanguage("ko");
if (getDiaryEntryDisplaySummary({ category: "food", summary: "Food checklist recorded." }) !== "식사") {
  throw new Error("Korean display must localize a legacy English default diary summary from its category");
}

if (getDiaryEntryDisplaySummary({ category: "memo", summary: "guardian note" }) !== "guardian note") {
  throw new Error("display fallback must preserve user-authored diary text");
}
setRuntimeLanguage(null);
