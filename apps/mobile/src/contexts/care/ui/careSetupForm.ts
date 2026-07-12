import { getLocalDateKey } from "../../../shared-kernel/date";
import type { ActiveCareSetup, CareSetupInput } from "../domain/carePlan";

export type CareSetupRepeatOption = "daily" | "custom";

export type CareSetupFormDraft = {
  conditionName: string;
  planTitle: string;
  medicationName: string;
  dosageLabel: string;
  startsOn: string;
  endsOn: string;
  repeat: CareSetupRepeatOption;
  repeatDays: string;
  times: string[];
};

export type CareMedicationSelection = string | null | undefined;

export type CareMedicationGroup = {
  medicationId: string;
  medicationName: string;
  dosageLabel: string;
  conditionId?: string;
  conditionName?: string;
  schedules: ActiveCareSetup["schedules"];
};

export function createCareSetupFormDraft(
  setup: ActiveCareSetup,
  includePrimaryMedication: boolean,
  selectedMedicationId?: string | null,
): CareSetupFormDraft {
  const selectedSchedules = includePrimaryMedication ? getSelectedMedicationSchedules(setup, selectedMedicationId) : [];
  const selectedSchedule = selectedSchedules[0];
  const editableCondition = getEditableCondition(setup, selectedSchedules, selectedMedicationId);
  const editablePlan = getEditablePlan(setup, editableCondition?.id);
  const recurrenceIntervalDays = selectedSchedule?.recurrenceIntervalDays ?? 1;

  return {
    conditionName: editableCondition?.name ?? "",
    planTitle: editablePlan?.title ?? "",
    medicationName: includePrimaryMedication ? selectedSchedule?.medicationName ?? "" : "",
    dosageLabel: includePrimaryMedication ? selectedSchedule?.dosageLabel ?? "" : "",
    startsOn: selectedSchedule?.startsOn ?? editablePlan?.startsOn ?? editableCondition?.startsOn ?? getLocalDateKey(),
    endsOn: selectedSchedule?.endsOn ?? editablePlan?.endsOn ?? editableCondition?.endsOn ?? "",
    repeat: recurrenceIntervalDays > 1 ? "custom" : "daily",
    repeatDays: String(recurrenceIntervalDays > 1 ? recurrenceIntervalDays : 2),
    times: includePrimaryMedication && selectedSchedules.length > 0
      ? selectedSchedules.map((schedule) => schedule.localTime.slice(0, 5))
      : [selectedSchedule?.localTime.slice(0, 5) ?? "08:00"],
  };
}

export function buildCareSetupInput(
  setup: ActiveCareSetup,
  draft: CareSetupFormDraft,
  editPrimaryMedication: boolean,
  selectedMedicationId?: string | null,
): CareSetupInput {
  const selectedSchedules = editPrimaryMedication ? getSelectedMedicationSchedules(setup, selectedMedicationId) : [];
  const editableCondition = getEditableCondition(setup, selectedSchedules, selectedMedicationId);
  const editablePlan = getEditablePlan(setup, editableCondition?.id);
  const recurrenceIntervalDays = draft.repeat === "daily" ? 1 : normalizeRepeatDays(draft.repeatDays);

  return {
    conditionId: editableCondition?.id,
    planId: editablePlan?.id,
    medicationId: selectedSchedules[0]?.medicationId,
    scheduleIds: selectedSchedules.map((schedule) => schedule.id),
    conditionName: draft.conditionName.trim(),
    planTitle: draft.planTitle.trim(),
    medicationName: draft.medicationName.trim(),
    dosageLabel: draft.dosageLabel.trim(),
    localTime: draft.times[0] ?? "08:00",
    localTimes: draft.times,
    startsOn: draft.startsOn,
    endsOn: draft.endsOn || undefined,
    recurrenceIntervalDays,
    instructions: editablePlan?.instructions,
  };
}

export function isCareSetupDraftEmpty(draft: CareSetupFormDraft) {
  return !draft.conditionName.trim() && !draft.planTitle.trim() && !draft.medicationName.trim();
}

export function careSetupDraftKey(setup: ActiveCareSetup, petId?: string) {
  return JSON.stringify({
    petId: petId ?? null,
    conditionId: setup.condition?.id ?? setup.conditions[0]?.id ?? null,
    conditionName: setup.condition?.name ?? setup.conditionName ?? setup.conditions[0]?.name ?? "",
    plans: setup.plans.map((plan) => [plan.id, plan.conditionId ?? null, plan.title, plan.instructions ?? null, plan.startsOn ?? null, plan.endsOn ?? null]),
    planId: setup.plan?.id ?? null,
    planTitle: setup.plan?.title ?? setup.planTitle ?? "",
    schedules: setup.schedules.map((schedule) => [schedule.id, schedule.medicationId, schedule.medicationName, schedule.dosageLabel, schedule.localTime, schedule.startsOn, schedule.endsOn ?? null, schedule.recurrenceIntervalDays]),
  });
}

export function getPrimaryMedicationSchedules(setup: ActiveCareSetup) {
  const medicationIds = new Set(setup.schedules.map((schedule) => schedule.medicationId));
  if (medicationIds.size !== 1) return [];
  const medicationId = [...medicationIds][0];
  return setup.schedules.filter((schedule) => schedule.medicationId === medicationId);
}

export function getCareMedicationGroups(setup: ActiveCareSetup): CareMedicationGroup[] {
  const groups = new Map<string, CareMedicationGroup>();
  for (const schedule of setup.schedules) {
    const existing = groups.get(schedule.medicationId);
    if (existing) {
      existing.schedules.push(schedule);
      continue;
    }
    groups.set(schedule.medicationId, {
      medicationId: schedule.medicationId,
      medicationName: schedule.medicationName,
      dosageLabel: schedule.dosageLabel,
      conditionId: schedule.conditionId,
      conditionName: schedule.conditionName,
      schedules: [schedule],
    });
  }
  return [...groups.values()];
}

export function getInitialCareMedicationSelection(setup: ActiveCareSetup): CareMedicationSelection {
  const groups = getCareMedicationGroups(setup);
  if (groups.length === 0) return undefined;
  if (groups.length === 1) return groups[0]?.medicationId;
  return null;
}

export function resolveCareMedicationSelection(setup: ActiveCareSetup, current: CareMedicationSelection): CareMedicationSelection {
  if (current === null) return null;
  if (current && getCareMedicationGroups(setup).some((group) => group.medicationId === current)) return current;
  return getInitialCareMedicationSelection(setup);
}

function getSelectedMedicationSchedules(setup: ActiveCareSetup, selectedMedicationId: CareMedicationSelection) {
  if (selectedMedicationId === null) return [];
  if (selectedMedicationId) return setup.schedules.filter((schedule) => schedule.medicationId === selectedMedicationId);
  return getPrimaryMedicationSchedules(setup);
}

function getEditableCondition(
  setup: ActiveCareSetup,
  selectedSchedules: ActiveCareSetup["schedules"],
  selectedMedicationId: CareMedicationSelection,
) {
  if (selectedMedicationId === null) return undefined;
  if (selectedMedicationId) {
    const conditionId = selectedSchedules[0]?.conditionId;
    return conditionId ? setup.conditions.find((condition) => condition.id === conditionId) : undefined;
  }
  if (setup.conditions.length !== 1) return undefined;
  return setup.conditions[0];
}

function getEditablePlan(setup: ActiveCareSetup, conditionId: string | undefined) {
  if (!conditionId) return undefined;
  const matchedPlan = setup.plans.find((plan) => plan.conditionId === conditionId);
  if (matchedPlan) return matchedPlan;
  if (setup.plan?.conditionId === conditionId) return setup.plan;
  if (setup.plan?.conditionId) return undefined;
  if (setup.condition?.id !== conditionId && setup.conditions.length !== 1) return undefined;
  return setup.plan;
}

function normalizeRepeatDays(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, parsed);
}
