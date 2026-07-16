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
  onPetNext?: () => void;
  selectNextPet: () => void;
};

export function useShellPetSelection({
  language,
  externalActivePet,
  externalPets,
  authActivePet,
  authPets,
  onPetNext,
  selectNextPet,
}: Params) {
  const previewPets = useMemo(() => buildSamplePets(language), [language]);
  const [previewPetIndex, setPreviewPetIndex] = useState(0);
  const shellPets = externalPets ?? authPets;
  const isPreviewPet = !externalActivePet && !authActivePet;
  const activePet = externalActivePet
    ?? authActivePet
    ?? previewPets[previewPetIndex % previewPets.length];
  const canCyclePet = isPreviewPet
    ? previewPets.length > 1
    : externalActivePet
      ? Boolean(onPetNext && shellPets.length > 1)
      : authPets.length > 1;
  const ownedPetCount = countOwnedPets(isPreviewPet ? previewPets : shellPets);

  function cyclePet() {
    if (!canCyclePet) return false;
    if (onPetNext) onPetNext();
    else if (isPreviewPet) setPreviewPetIndex((current) => (current + 1) % previewPets.length);
    else selectNextPet();
    return true;
  }

  return { activePet, ownedPetCount, canCyclePet, cyclePet, previewPets };
}
