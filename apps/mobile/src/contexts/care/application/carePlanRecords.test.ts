import type { CareMedicationSchedule } from "../domain/carePlan";
import { buildQuickDoseFromSchedule } from "./carePlanRecords";

const schedule: CareMedicationSchedule = {
  id: "schedule-1",
  medicationId: "medication-1",
  medicationName: "Cerenia",
  dosageLabel: "16mg 1정",
  conditionName: "구토",
  localTime: "08:00:00",
};

const dose = buildQuickDoseFromSchedule(schedule, "partial");
const medicationName: string = dose.medicationName;
const status: "partial" = dose.status;

void medicationName;
void status;
