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

export type PetRecord = {
  id: UUID;
  name: string;
  species: string;
  breed: string | null;
  birthdate: string | null;
  weight_kg: number | null;
};

export function mapDbPet(record: PetRecord): PetProfile {
  return {
    id: record.id,
    name: record.name,
    species: normalizeSpecies(record.species),
    breed: record.breed ?? "",
    ageLabel: humanizeAgeLabel(record.birthdate),
    weightKg: record.weight_kg ?? 0,
    careMode: true,
  };
}

export function normalizeSpecies(value: string): Species {
  if (value === "dog" || value === "cat") {
    return value;
  }

  return "other";
}

export function humanizeAgeLabel(birthdate: string | null): string {
  if (!birthdate) {
    return "--";
  }

  const birth = new Date(`${birthdate}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime())) {
    return "--";
  }

  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    years -= 1;
  }

  if (years <= 0) {
    const months = (today.getFullYear() - birth.getFullYear()) * 12 + monthDiff + (today.getDate() >= birth.getDate() ? 0 : -1);
    return `${Math.max(months, 0)}m`;
  }

  return `${years}y`;
}

export function isCareMode(pet: PetProfile) {
  return pet.careMode;
}
