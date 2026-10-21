import { Text, View } from "react-native";
import type { ComponentProps } from "react";
import { useMedicationDosesByDateRange } from "../../contexts/medication/application/medicationDoseRecords";
import { createTodayMedicationAgendaRows } from "../../contexts/medication/ui/todayMedicationAgenda";
import { buildQuickDoseFromSchedule } from "../../contexts/care/application/carePlanRecords";
import { findDoseForScheduleDate } from "../../contexts/medication/application/medicationDosePayload";
import { CareModeScreen } from "./CareModeScreen";
export type MedicationDestinationScreenProps = Omit<ComponentProps<typeof CareModeScreen>, "medicationAgenda"> & {
  /** Explicit destination date, shared by the displayed agenda and every create/edit. */
  dateKey: string;
  userId: string | null;
  /** Optional notification target limits the agenda to this schedule, never another schedule. */
  scheduleId?: string;
};
/** The keyed native form subtree cannot carry a pet/date's draft into another target. */
export function MedicationDestinationScreen({ dateKey, userId, scheduleId, ...props }: MedicationDestinationScreenProps) {
  const query = useMedicationDosesByDateRange(userId ? props.petId : null, dateKey, dateKey, userId);
  const records = (userId ? query.data ?? [] : props.doses).filter((dose) => dose.petId === props.petId && dose.doseDate === dateKey);
  const doses = scheduleId ? records.filter((dose) => dose.scheduleId === scheduleId) : records;
  const schedules = scheduleId ? props.careSetup.schedules.filter((schedule) => schedule.id === scheduleId) : props.careSetup.schedules;
  const medicationAgenda = createTodayMedicationAgendaRows({ schedules, doses, doseDate: dateKey });
  const status = userId && query.isError || props.careStatus === "error" ? "error" : userId && query.isPending || props.careStatus === "loading" ? "loading" : "ready";
  return <View><Text>{dateKey}</Text><CareModeScreen {...props} key={`${props.petId}:${dateKey}`}
    dateKey={dateKey} doses={doses} medicationAgenda={medicationAgenda} careSetup={{ ...props.careSetup, schedules }} careStatus={status}
    onRetryCare={() => { void query.refetch(); props.onRetryCare?.(); }}
    onAddDose={(input, source) => props.onAddDose({ ...input, doseDate: dateKey }, source)}
    onUpdateDose={(input) => props.onUpdateDose({ ...input, doseDate: dateKey })}
    onUseSchedule={(schedule) => { if (!findDoseForScheduleDate(records, schedule.id, dateKey)) void props.onAddDose({ ...buildQuickDoseFromSchedule(schedule), doseDate: dateKey }); }}
  /></View>;
}
