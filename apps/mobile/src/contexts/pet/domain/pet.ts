import type { UUID } from "../../../shared-kernel/types";

export type Species = "dog" | "cat" | "other";

export type PetProfile = {
  id: UUID;
  name: string;
  species: Species;
  breed: string;
  ageLabel: string;
  weightKg: number;
  careMode: boolean;
};

export function isCareMode(pet: PetProfile) {
  return pet.careMode;
}

