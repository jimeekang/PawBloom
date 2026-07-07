import type { ComponentProps } from "react";
import type { ActiveCareSetup } from "../domain/carePlan";
import { ProfileCareDefaultsPanel } from "./ProfileCareDefaultsPanel";

const setup: ActiveCareSetup = {
  conditions: [{ id: "condition-1", name: "피부염", status: "active" }],
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
  }],
};

const props: ComponentProps<typeof ProfileCareDefaultsPanel> = {
  setup,
  onSave: () => undefined,
};

void props;
