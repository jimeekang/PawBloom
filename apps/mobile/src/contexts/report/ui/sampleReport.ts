import type { VetReport } from "../domain/vetReport";
import type { Language } from "../../../shared-kernel/types";

export function buildSampleReport(petId: string, language: Language = "ko"): VetReport {
  return {
    id: "report-safety-fixture",
    petId,
    rangeDays: 7,
    status: "draft",
    englishSummary: "Record-based report fixture for local safety verification.",
    confirmedByOwner: false,
    disclaimer: language === "en"
      ? "This is a record-based summary, not a diagnosis. Contact a veterinarian for medical decisions."
      : "이 내용은 진단이 아니라 기록 기반 요약입니다. 의학적 판단은 수의사에게 문의하세요.",
  };
}
