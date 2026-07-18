import type { Language, PetMemberRole, UUID } from "../../../shared-kernel/types";

export type Species = "dog" | "cat" | "other";

export type PetProfile = {
  id: UUID;
  name: string;
  species: Species;
  breed: string;
  birthdate: string;
  ageLabel: string;
  weightKg: number;
  careMode: boolean;
  role: PetMemberRole;
};

export type PetRecord = {
  id: UUID;
  name: string;
  species: string;
  breed: string | null;
  birthdate: string | null;
  weight_kg: number | null;
};

export function mapDbPet(record: PetRecord, role: PetMemberRole): PetProfile {
  return {
    id: record.id,
    name: record.name,
    species: normalizeSpecies(record.species),
    breed: record.breed ?? "",
    birthdate: record.birthdate ?? "",
    ageLabel: humanizeAgeLabel(record.birthdate),
    weightKg: record.weight_kg ?? 0,
    careMode: true,
    role,
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

export function localizePetAgeLabel(ageLabel: string, language: Language): string {
  const match = ageLabel.match(/^(\d+)(y|m)$/);
  if (!match) return "";
  if (language === "ko") return match[2] === "y" ? `${match[1]}살` : `${match[1]}개월`;
  return match[2] === "y" ? `${match[1]} yr` : `${match[1]} mo`;
}

export function formatPetMetaLine(pet: Pick<PetProfile, "breed" | "ageLabel">, language: Language): string {
  return [pet.breed, localizePetAgeLabel(pet.ageLabel, language)].filter(Boolean).join(" · ");
}

export function isCareMode(pet: PetProfile) {
  return pet.careMode;
}
