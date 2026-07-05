import type { AppIconName } from "../../design-system/iconography";
import type { TranslationKey } from "../../i18n/translations";

export type SaveFeedbackKind = "diary" | "medication" | "medicationStatus" | "routine" | "careSetup" | "petProfile" | "checklist";
export type SaveFeedbackTone = "success" | "settings";

export type SaveFeedback = {
  kind: SaveFeedbackKind;
  tone: SaveFeedbackTone;
  icon: AppIconName;
  titleKey: TranslationKey;
  messageKey: TranslationKey;
  id: number;
};

const feedbackByKind: Record<SaveFeedbackKind, Omit<SaveFeedback, "kind" | "id">> = {
  diary: { tone: "success", icon: "diary", titleKey: "feedback.diarySavedTitle", messageKey: "feedback.diarySavedMessage" },
  medication: { tone: "success", icon: "medication", titleKey: "feedback.medicationSavedTitle", messageKey: "feedback.medicationSavedMessage" },
  medicationStatus: { tone: "success", icon: "check", titleKey: "feedback.medicationStatusTitle", messageKey: "feedback.medicationStatusMessage" },
  checklist: { tone: "success", icon: "check", titleKey: "feedback.checklistSavedTitle", messageKey: "feedback.checklistSavedMessage" },
  routine: { tone: "settings", icon: "settings", titleKey: "feedback.routineSavedTitle", messageKey: "feedback.routineSavedMessage" },
  careSetup: { tone: "settings", icon: "medication", titleKey: "feedback.careSetupSavedTitle", messageKey: "feedback.careSetupSavedMessage" },
  petProfile: { tone: "settings", icon: "pet", titleKey: "feedback.petProfileSavedTitle", messageKey: "feedback.petProfileSavedMessage" },
};

export function createSaveFeedback(kind: SaveFeedbackKind, id = Date.now()): SaveFeedback {
  return { kind, id, ...feedbackByKind[kind] };
}
