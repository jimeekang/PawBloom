import { useMemo, useState } from "react";
import { countOwnedPets, type PetProfile } from "../../contexts/pet/domain/pet";
import { buildSamplePets } from "../../contexts/pet/ui/samplePets";
import type { Language } from "../../shared-kernel/types";

type Params = {
  language: Language;
  externalActivePet?: PetProfile | null;
  externalPets?: PetProfile[];
  authActivePet: PetProfile | null;
  authPets: PetProfile[];
  authenticated: boolean;
  onSelectPet?: (petId: string) => void;
  selectPet: (petId: string) => void;
};
/** Selection resolves IDs only within this account's current accessible list. */
export function findAccessiblePet(pets: readonly PetProfile[], petId: string) { return pets.find((pet) => pet.id === petId); }
export function useShellPetSelection({ language, externalActivePet, externalPets, authActivePet, authPets, authenticated, onSelectPet, selectPet }: Params) {
  const previewPets = useMemo(() => buildSamplePets(language), [language]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isPreviewPet = !authenticated && !externalActivePet;
  const accessiblePets = isPreviewPet ? previewPets : externalPets ?? authPets;
  const selectedPet = selectedId ? findAccessiblePet(accessiblePets, selectedId) : undefined;
  const initialPet = externalActivePet ?? authActivePet;
  const activePet = selectedPet ?? (initialPet && findAccessiblePet(accessiblePets, initialPet.id)) ?? accessiblePets[0] ?? previewPets[0];
  const ownedPetCount = countOwnedPets(accessiblePets);
  function selectPetId(petId: string) {
    if (!findAccessiblePet(accessiblePets, petId)) return false;
    setSelectedId(petId);
    if (!isPreviewPet) (onSelectPet ?? selectPet)(petId);
    return true;
  }
  return { activePet, accessiblePets, ownedPetCount, selectPetId, previewPets, isPreviewPet };
}
