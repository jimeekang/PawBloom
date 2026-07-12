import type { VetReport } from "../domain/vetReport";

export function buildSampleReport(petId: string): VetReport {
  return {
    id: "report-safety-fixture",
    petId,
    rangeDays: 7,
    status: "draft",
    englishSummary: "Record-based report fixture for local safety verification.",
    confirmedByOwner: false,
    disclaimer: "이 내용은 진단이 아니라 기록 기반 요약입니다. 의학적 판단은 수의사에게 문의하세요.",
  };
}
