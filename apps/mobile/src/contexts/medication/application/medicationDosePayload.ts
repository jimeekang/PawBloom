import type { DoseRecord, DoseStatus } from "../domain/medication";

type MedicationDoseCareNote = { version: 1; conditionName?: string; dosageLabel?: string; administeredAmount?: string; reactionNote?: string };

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

export function mapMedicationDoseInsertPayloadToRecord(payload: MedicationDoseInsertPayload, id: string): DoseRecord {
  const careNote = decodeMedicationDoseCareNote(payload.reaction_note);
  return {
    id,
    petId: payload.pet_id,
    scheduleId: payload.schedule_id ?? undefined,
    doseDate: payload.dose_date,
    medicationName: payload.medication_name,
    scheduledAt: formatTime(payload.scheduled_at),
    status: payload.status,
    recordedAt: payload.recorded_at ?? undefined,
    ...careNote,
  };
}

export function mergeMedicationDoseUpdatePayloadIntoRecord(current: DoseRecord, payload: Record<string, unknown>): DoseRecord {
  const careNote = typeof payload.reaction_note === "string" || payload.reaction_note === null ? decodeMedicationDoseCareNote(payload.reaction_note) : {};
  return {
    ...current,
    medicationName: typeof payload.medication_name === "string" ? payload.medication_name : current.medicationName,
    scheduledAt: typeof payload.scheduled_at === "string" ? formatTime(payload.scheduled_at) : current.scheduledAt,
    status: isDoseStatus(payload.status) ? payload.status : current.status,
    recordedAt: payload.recorded_at === null ? undefined : typeof payload.recorded_at === "string" ? payload.recorded_at : current.recordedAt,
    ...careNote,
  };
}

export function encodeMedicationDoseCareNote(input: Pick<MedicationDosePayloadInput, "conditionName" | "dosageLabel" | "administeredAmount" | "reactionNote">): string | null {
  const careNote = { version: 1, conditionName: cleanOptional(input.conditionName), dosageLabel: cleanOptional(input.dosageLabel), administeredAmount: cleanOptional(input.administeredAmount), reactionNote: cleanOptional(input.reactionNote) };
  if (!careNote.conditionName && !careNote.dosageLabel && !careNote.administeredAmount && !careNote.reactionNote) return null;
  return JSON.stringify(careNote);
}

export function decodeMedicationDoseCareNote(value: string | null | undefined): Omit<MedicationDoseCareNote, "version"> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Partial<MedicationDoseCareNote>;
    if (parsed.version !== 1) return { reactionNote: value };
    return { conditionName: cleanOptional(parsed.conditionName), dosageLabel: cleanOptional(parsed.dosageLabel), administeredAmount: cleanOptional(parsed.administeredAmount), reactionNote: cleanOptional(parsed.reactionNote) };
  } catch {
    return { reactionNote: value };
  }
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

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function isDoseStatus(value: unknown): value is DoseStatus {
  return value === "pending" || value === "completed" || value === "skipped" || value === "partial";
}
