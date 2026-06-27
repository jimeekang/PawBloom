import type { UUID } from "../../../shared-kernel/types";

export type RoutineMealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export type RoutineRelativeLevel = "less" | "normal" | "more";
export type RoutineWalkIntensity = "low" | "normal" | "high";
export type RoutineStoolConsistency = "normal" | "soft" | "diarrhea" | "hard";
export type RoutineAppetite = "good" | "normal" | "low" | "refused";

export type PetRoutine = {
  id?: UUID;
  petId: UUID;
  food: { meals: Partial<Record<RoutineMealSlot, { offeredGrams?: string }>>; appetite?: RoutineAppetite };
  water: { amountMl?: string; intakeLevel?: RoutineRelativeLevel };
  walk: { enabled?: boolean; durationMinutes?: string; intensity?: RoutineWalkIntensity };
  stool: { count?: string; consistency?: RoutineStoolConsistency };
  condition: { energyLevel?: RoutineRelativeLevel };
};

export type PetRoutineInput = Omit<PetRoutine, "id" | "petId">;
