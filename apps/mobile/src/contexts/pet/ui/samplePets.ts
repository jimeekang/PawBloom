import type { PetProfile } from "../domain/pet";
import type { Language } from "../../../shared-kernel/types";

const samplePet: PetProfile = {
  id: "pet-demo-milo",
  name: "Milo",
  species: "dog",
  breed: "Cavoodle",
  birthdate: "2021-05-12",
  ageLabel: "4 years",
  weightKg: 8.4,
  careMode: true,
  role: "owner",
};

export function buildSamplePets(language: Language = "ko"): PetProfile[] {
  if (language === "en") {
    return [
      { ...samplePet, id: "pet-demo-mochi", name: "Mochi", breed: "Shiba Inu", ageLabel: "2 years 3 months", weightKg: 9.2 },
      { ...samplePet, id: "pet-demo-luna", name: "Luna", breed: "Domestic Shorthair", ageLabel: "5 years", weightKg: 4.1, careMode: false },
    ];
  }

  return [
    { ...samplePet, id: "pet-demo-mochi", name: "모찌", breed: "시바", ageLabel: "2살 3개월", weightKg: 9.2 },
    { ...samplePet, id: "pet-demo-luna", name: "루나", breed: "코리안 숏헤어", ageLabel: "5살", weightKg: 4.1, careMode: false },
  ];
}
