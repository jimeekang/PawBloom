import type { DoseRecord } from "../domain/medication";
import type { Language } from "../../../shared-kernel/types";

const doseCopy: Record<Language, { probiotic: string; prevention: string; note: string }> = {
  en: { probiotic: "Probiotic", prevention: "Heartworm preventive", note: "No vomiting after the dose" },
  ko: { probiotic: "프로바이오틱스", prevention: "심장사상충 예방약", note: "투약 후 구토 없음" },
};

export function buildSampleDoses(petId: string, language: Language = "ko"): DoseRecord[] {
  const copy = doseCopy[language];
  return [
    { id: "dose-ui-1", petId, medicationName: copy.probiotic, scheduledAt: "08:10", status: "completed", recordedAt: "08:34", reactionNote: copy.note },
    { id: "dose-ui-2", petId, medicationName: copy.prevention, scheduledAt: "20:00", status: "pending" },
  ];
}

export function relocalizeSampleDoses(doses: DoseRecord[], language: Language): DoseRecord[] {
  const target = sampleDoseById(language);
  const known = [sampleDoseById("ko"), sampleDoseById("en")];
  return doses.map((dose) => {
    const targetDose = target.get(dose.id);
    if (!targetDose) return dose;
    const knownNames = known.map((items) => items.get(dose.id)?.medicationName);
    const knownNotes = known.map((items) => items.get(dose.id)?.reactionNote);
    return {
      ...dose,
      medicationName: knownNames.includes(dose.medicationName) ? targetDose.medicationName : dose.medicationName,
      reactionNote: knownNotes.includes(dose.reactionNote) ? targetDose.reactionNote : dose.reactionNote,
    };
  });
}

function sampleDoseById(language: Language) {
  const copy = doseCopy[language];
  return new Map<string, Pick<DoseRecord, "medicationName" | "reactionNote">>([
    ["dose-ui-1", { medicationName: copy.probiotic, reactionNote: copy.note }],
    ["dose-ui-2", { medicationName: copy.prevention }],
  ]);
}
