import type { PetProfile } from "../domain/pet";

const samplePet: PetProfile = {
  id: "pet-demo-milo",
  name: "밀로",
  species: "dog",
  breed: "카보돌",
  birthdate: "2021-05-12",
  ageLabel: "4살",
  weightKg: 8.4,
  careMode: true,
};

export const mockPets: PetProfile[] = [
  { ...samplePet, id: "pet-demo-mochi", name: "모찌", breed: "시바", ageLabel: "2살 3개월", weightKg: 9.2 },
  { ...samplePet, id: "pet-demo-luna", name: "루나", breed: "코리안 숏헤어", ageLabel: "5살", weightKg: 4.1, careMode: false },
];
