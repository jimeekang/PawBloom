import { createSaveFeedback } from "./saveFeedback";

const diaryFeedback = createSaveFeedback("diary");
const routineFeedback = createSaveFeedback("routine");

if (diaryFeedback.tone !== "success") {
  throw new Error("diary saves must use the success feedback tone");
}

if (diaryFeedback.titleKey !== "feedback.diarySavedTitle") {
  throw new Error("diary saves must show a diary-specific saved title");
}

if (routineFeedback.tone !== "settings") {
  throw new Error("routine saves must use the stronger settings feedback tone");
}

if (routineFeedback.messageKey !== "feedback.routineSavedMessage") {
  throw new Error("routine saves must explain that defaults are reused later");
}
