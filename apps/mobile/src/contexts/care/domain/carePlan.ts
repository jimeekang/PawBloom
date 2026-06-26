import type { UUID } from "../../../shared-kernel/types";

export type CarePlan = {
  id: UUID;
  petId: UUID;
  conditionName: string;
  instructions: string;
  startsOn: string;
  endsOn?: string;
};

export function isActiveCarePlan(plan: CarePlan, today: string) {
  return plan.startsOn <= today && (!plan.endsOn || plan.endsOn >= today);
}

