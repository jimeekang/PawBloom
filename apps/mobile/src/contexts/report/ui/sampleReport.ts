import type { VetReport } from "../domain/vetReport";

export function buildSampleReport(petId: string): VetReport {
  return {
    id: "report-demo",
    petId,
    rangeDays: 7,
    status: "draft",
    englishSummary:
      "최근 기록에서 식욕이 줄었습니다. 오늘 물 섭취량이 적었고, 묽은 대변이 한 번 있었고, 오전 투약은 구토 없이 완료되었습니다.",
    confirmedByOwner: false,
    disclaimer: "이 내용은 진단이 아니라 기록 기반 요약입니다. 의학적 판단은 수의사에게 문의하세요.",
  };
}
