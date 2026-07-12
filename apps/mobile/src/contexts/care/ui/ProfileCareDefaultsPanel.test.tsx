import type { ComponentProps } from "react";
import type { ActiveCareSetup } from "../domain/carePlan";
import { buildCareSetupInput, createCareSetupFormDraft, getCareMedicationGroups, getInitialCareMedicationSelection } from "./careSetupForm";
import { buildNextLocalCareSetup } from "./careSetupLocalState";
import { ProfileCareDefaultsPanel } from "./ProfileCareDefaultsPanel";

const setup: ActiveCareSetup = {
  conditions: [{ id: "condition-1", name: "피부염", status: "active" }],
  plans: [],
  conditionName: "피부염",
  schedules: [{
    id: "schedule-1",
    medicationId: "medication-1",
    medicationName: "항생제",
    dosageLabel: "1정",
    conditionId: "condition-1",
    conditionName: "피부염",
    localTime: "08:30:00",
    startsOn: "2026-07-04",
    recurrenceIntervalDays: 1,
  }, {
    id: "schedule-2",
    medicationId: "medication-1",
    medicationName: "항생제",
    dosageLabel: "1정",
    conditionId: "condition-1",
    conditionName: "피부염",
    localTime: "20:30:00",
    startsOn: "2026-07-04",
    recurrenceIntervalDays: 1,
  }],
};

const props: ComponentProps<typeof ProfileCareDefaultsPanel> = {
  setup,
  onSave: async () => setup,
};

const draft = createCareSetupFormDraft(setup, true);
if (draft.times.join(",") !== "08:30,20:30") throw new Error("profile care draft must preserve every time for the primary medication");
const input = buildCareSetupInput(setup, draft, true);
if (input.scheduleIds?.join(",") !== "schedule-1,schedule-2" || input.localTimes?.join(",") !== "08:30,20:30") {
  throw new Error("profile care save input must keep schedule ids aligned with every local time");
}

const ambiguousSetup: ActiveCareSetup = {
  ...setup,
  conditions: [...setup.conditions, { id: "condition-2", name: "관절염", status: "active" }],
  plan: { id: "plan-1", conditionId: "condition-1", title: "피부 관리", instructions: "plan A instructions" },
  plans: [
    { id: "plan-1", conditionId: "condition-1", title: "피부 관리", instructions: "plan A instructions" },
    { id: "plan-2", conditionId: "condition-2", title: "관절 관리", instructions: "plan B instructions" },
  ],
  schedules: [
    ...setup.schedules,
    { ...setup.schedules[0]!, id: "schedule-3", medicationId: "medication-2", medicationName: "소염제", dosageLabel: "반 정", conditionId: "condition-2", conditionName: "관절염", localTime: "07:15:00" },
    { ...setup.schedules[0]!, id: "schedule-4", medicationId: "medication-2", medicationName: "소염제", dosageLabel: "반 정", conditionId: "condition-2", conditionName: "관절염", localTime: "19:15:00" },
  ],
};
const ambiguousDraft = createCareSetupFormDraft(ambiguousSetup, true);
const ambiguousInput = buildCareSetupInput(ambiguousSetup, ambiguousDraft, true);
if (ambiguousDraft.conditionName || ambiguousDraft.medicationName || ambiguousInput.conditionId || ambiguousInput.medicationId) {
  throw new Error("care defaults must not silently select and rename an arbitrary condition or medication when several exist");
}

if (getInitialCareMedicationSelection(ambiguousSetup) !== null || getCareMedicationGroups(ambiguousSetup).length !== 2) {
  throw new Error("multiple saved medications must require an explicit medication selection");
}

const medicationBDraft = createCareSetupFormDraft(ambiguousSetup, true, "medication-2");
if (medicationBDraft.conditionName !== "관절염" || medicationBDraft.planTitle !== "관절 관리" || medicationBDraft.medicationName !== "소염제" || medicationBDraft.times.join(",") !== "07:15,19:15") {
  throw new Error("selecting medication B must load only its linked condition, care plan, medication values, and times");
}

const medicationBInput = buildCareSetupInput(ambiguousSetup, {
  ...medicationBDraft,
  dosageLabel: "1정",
  times: ["07:30", "19:30"],
}, true, "medication-2");
if (
  medicationBInput.conditionId !== "condition-2"
  || medicationBInput.planId !== "plan-2"
  || medicationBInput.medicationId !== "medication-2"
  || medicationBInput.scheduleIds?.join(",") !== "schedule-3,schedule-4"
  || medicationBInput.localTimes?.join(",") !== "07:30,19:30"
  || medicationBInput.instructions !== "plan B instructions"
) {
  throw new Error("selecting medication B must save its exact condition, plan, medication, and schedule ids/content");
}

const medicationABefore = ambiguousSetup.schedules
  .filter((schedule) => schedule.medicationId === "medication-1")
  .map((schedule) => [schedule.id, schedule.localTime, schedule.dosageLabel].join(":"))
  .sort()
  .join("|");
const updatedSetup = buildNextLocalCareSetup(ambiguousSetup, medicationBInput, 9000);
const medicationAAfter = updatedSetup.schedules
  .filter((schedule) => schedule.medicationId === "medication-1")
  .map((schedule) => [schedule.id, schedule.localTime, schedule.dosageLabel].join(":"))
  .sort()
  .join("|");
const updatedMedicationB = updatedSetup.schedules.filter((schedule) => schedule.medicationId === "medication-2");
const updatedPlanA = updatedSetup.plans.find((plan) => plan.id === "plan-1");
const updatedPlanB = updatedSetup.plans.find((plan) => plan.id === "plan-2");
if (medicationAAfter !== medicationABefore) {
  throw new Error("editing medication B must leave medication A and all of its schedules untouched");
}
if (updatedMedicationB.map((schedule) => schedule.id).join(",") !== "schedule-3,schedule-4" || updatedMedicationB.map((schedule) => schedule.localTime).join(",") !== "07:30:00,19:30:00") {
  throw new Error("editing medication B must reconcile only medication B's exact schedule set");
}
if (updatedPlanA?.title !== "피부 관리" || updatedPlanA.instructions !== "plan A instructions") {
  throw new Error("editing plan B must leave plan A untouched");
}
if (updatedPlanB?.conditionId !== "condition-2" || updatedPlanB.title !== "관절 관리" || updatedPlanB.instructions !== "plan B instructions") {
  throw new Error("editing plan B must preserve its exact id, condition, and content");
}

const newMedicationDraft = createCareSetupFormDraft(ambiguousSetup, true, null);
const newMedicationInput = buildCareSetupInput(ambiguousSetup, { ...newMedicationDraft, medicationName: "새 약", dosageLabel: "1정" }, true, null);
if (newMedicationInput.medicationId || newMedicationInput.scheduleIds?.length) {
  throw new Error("add medication mode must create a new medication instead of reusing an existing medication id");
}

void props;
