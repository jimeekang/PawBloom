import type { DoseRecord, DoseStatus } from "../domain/medication";

export type MedicationDoseInsertPayload = {
  pet_id: string;
  created_by: string;
  schedule_id?: string | null;
  dose_date: string;
  medication_name: string;
  scheduled_at: string;
  status: DoseStatus;
  recorded_at: string | null;
  reaction_note: string | null;
  client_mutation_id?: string | null;
};

export type MedicationDosePayloadInput = {
  scheduleId?: string;
  doseDate?: string;
  scheduledTime?: string;
  conditionName?: string;
  medicationName: string;
  dosageLabel?: string;
  administeredAmount?: string;
  reactionNote?: string;
  status?: DoseStatus;
  petId?: string;
  userId?: string;
  clientMutationId?: string;
  now?: Date;
};

export function buildMedicationDoseInsertPayload(input: MedicationDosePayloadInput): MedicationDoseInsertPayload {
  const status = input.status ?? "pending";
  const now = input.now ?? new Date();
  const scheduledAt = buildScheduledAtForDateTime(input.doseDate, input.scheduledTime, now);
  return {
    pet_id: input.petId ?? "",
    created_by: input.userId ?? "",
    schedule_id: input.scheduleId ?? null,
    dose_date: input.doseDate ?? localDateKey(scheduledAt),
    medication_name: input.medicationName.trim() || "투약",
    scheduled_at: scheduledAt.toISOString(),
    status,
    recorded_at: buildDoseRecordedAt(status, now),
    reaction_note: encodeMedicationDoseCareNote(input),
    client_mutation_id: input.clientMutationId ?? null,
  };
}

export function findDoseForScheduleDate(doses: DoseRecord[], scheduleId: string, doseDate: string) {
  return doses.find((dose) => dose.scheduleId === scheduleId && dose.doseDate === doseDate);
}

export function mergeSavedDoseIntoList(doses: DoseRecord[], saved: DoseRecord) {
  return [saved, ...doses.filter((dose) => {
    if (saved.scheduleId && dose.scheduleId === saved.scheduleId && dose.doseDate === saved.doseDate) return false;
    return dose.id !== saved.id;
  })];
}

export function encodeMedicationDoseCareNote(input: Pick<MedicationDosePayloadInput, "conditionName" | "dosageLabel" | "administeredAmount" | "reactionNote">): string | null {
  const careNote = { version: 1, conditionName: cleanOptional(input.conditionName), dosageLabel: cleanOptional(input.dosageLabel), administeredAmount: cleanOptional(input.administeredAmount), reactionNote: cleanOptional(input.reactionNote) };
  if (!careNote.conditionName && !careNote.dosageLabel && !careNote.administeredAmount && !careNote.reactionNote) return null;
  return JSON.stringify(careNote);
}

export function buildDoseRecordedAt(status: DoseStatus, recordedAt = new Date()) {
  return status === "pending" ? null : recordedAt.toISOString();
}

function buildScheduledAtForDateTime(doseDate?: string, scheduledTime?: string, fallback = new Date()) {
  const scheduledAt = new Date(fallback);
  if (doseDate) {
    const [year, month, day] = doseDate.split("-").map(Number);
    scheduledAt.setFullYear(year ?? scheduledAt.getFullYear(), (month ?? scheduledAt.getMonth() + 1) - 1, day ?? scheduledAt.getDate());
  }
  const timeMatch = scheduledTime?.match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    scheduledAt.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
  }
  return scheduledAt;
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function cleanOptional(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
