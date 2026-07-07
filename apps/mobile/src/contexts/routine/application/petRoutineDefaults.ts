import type { Species } from "../../pet/domain/pet";
import type { PetRoutine } from "../domain/petRoutine";

export function createDefaultPetRoutine(petId: string, species: Species = "dog"): PetRoutine {
  return { petId, food: { meals: { breakfast: {}, lunch: {}, dinner: {} }, appetite: "normal" }, water: { intakeLevel: "normal" }, walk: { enabled: species === "dog", intensity: "normal" }, stool: { consistency: "normal" }, condition: { energyLevel: "normal" } };
}
