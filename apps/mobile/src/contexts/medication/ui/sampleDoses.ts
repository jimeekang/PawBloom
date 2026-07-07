import type { DoseRecord } from "../domain/medication";

export function buildSampleDoses(petId: string): DoseRecord[] {
  return [
    { id: "dose-ui-1", petId, medicationName: "프로바이오틱스", scheduledAt: "08:10", status: "completed", recordedAt: "08:34", reactionNote: "투약 후 구토 없음" },
    { id: "dose-ui-2", petId, medicationName: "심장사상충 예방약", scheduledAt: "20:00", status: "pending" },
  ];
}
