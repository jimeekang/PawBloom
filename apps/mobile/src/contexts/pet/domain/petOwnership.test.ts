import { countOwnedPets } from "./pet";

const ownedCount = countOwnedPets([
  { role: "owner" },
  { role: "caregiver" },
  { role: "pet_sitter" },
  { role: "owner" },
]);

if (ownedCount !== 2) {
  throw new Error("plan limits must exclude pets shared through caregiver or pet-sitter access");
}
