import type { AiBrief } from "../domain/aiBrief";
import type { Language } from "../../../shared-kernel/types";

export function buildSampleBrief(petId: string, language: Language = "ko"): AiBrief {
  const copy = language === "en"
    ? {
        highlights: [
          "Recent records show lower appetite than usual.",
          "One loose stool was recorded today.",
          "The morning medication was recorded on time.",
        ],
        questionsForVet: [
          "When did the reduced appetite begin?",
          "Should the current medication schedule stay the same?",
        ],
        disclaimer: "This is a record-based summary, not a diagnosis. Contact a veterinarian for medical decisions.",
      }
    : {
        highlights: [
          "최근 기록에서 식욕이 평소보다 낮았습니다.",
          "오늘 묽은 대변이 한 번 기록되었습니다.",
          "오전에 투약이 제시간에 기록되었습니다.",
        ],
        questionsForVet: [
          "식욕 저하는 언제 시작되었나요?",
          "현재 투약 스케줄을 그대로 유지해도 될까요?",
        ],
        disclaimer: "이 내용은 진단이 아니라 기록 기반 요약입니다. 의학적 판단은 수의사에게 문의하세요.",
      };
  return {
    id: "brief-demo",
    petId,
    rangeDays: 3,
    highlights: copy.highlights,
    questionsForVet: copy.questionsForVet,
    disclaimer: copy.disclaimer,
  };
}
