import { createSaveFeedback } from "./saveFeedback";
import type { SaveFeedbackKind } from "./saveFeedback";

const expectedCategoryFeedback: Record<"diary" | "medication" | "routine" | "petProfile", { titleKey: string; messageKey: string }> = {
  diary: { titleKey: "feedback.diarySavedTitle", messageKey: "feedback.diarySavedMessage" },
  medication: { titleKey: "feedback.medicationSavedTitle", messageKey: "feedback.medicationSavedMessage" },
  routine: { titleKey: "feedback.routineSavedTitle", messageKey: "feedback.routineSavedMessage" },
  petProfile: { titleKey: "feedback.petProfileSavedTitle", messageKey: "feedback.petProfileSavedMessage" },
};

for (const [kind, expected] of Object.entries(expectedCategoryFeedback) as Array<[SaveFeedbackKind, { titleKey: string; messageKey: string }]>) {
  const feedback = createSaveFeedback(kind);

  if (feedback.titleKey !== expected.titleKey) {
    throw new Error(`${kind} saves must show a category-specific saved title`);
  }

  if (feedback.messageKey !== expected.messageKey) {
    throw new Error(`${kind} saves must show the matching category-specific saved message`);
  }
}

if (createSaveFeedback("diary").tone !== "success") {
  throw new Error("diary saves must use the success feedback tone");
}

if (createSaveFeedback("routine").tone !== "settings") {
  throw new Error("routine saves must use the stronger settings feedback tone");
}
