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
  const en = language === "en";
  return [
    { ...samplePet, id: "pet-demo-mochi", name: en ? "Mochi" : "모찌", breed: en ? "Shiba Inu" : "시바", ageLabel: en ? "2 years 3 months" : "2살 3개월", weightKg: 9.2 },
    { ...samplePet, id: "pet-demo-luna", name: en ? "Luna" : "루나", species: "cat", breed: en ? "Domestic Shorthair" : "코리안 숏헤어", ageLabel: en ? "5 years" : "5살", weightKg: 4.1, careMode: false },
    { ...samplePet, id: "pet-demo-cheese", name: en ? "Cheese" : "치즈", species: "cat", breed: en ? "Domestic Shorthair" : "코리안 숏헤어", ageLabel: en ? "3 years" : "3살", weightKg: 4.5, careMode: false },
    { ...samplePet, id: "pet-demo-coco", name: en ? "Coco" : "코코", species: "cat", breed: en ? "Calico" : "삼색 고양이", ageLabel: en ? "1 year" : "1살", weightKg: 3.2, careMode: false },
  ];
}
