import { useMemo, useState } from "react";
import { createDefaultPetRoutine, usePetRoutine, useUpsertPetRoutine } from "../application/petRoutineRecords";
import type { PetRoutineInput } from "../domain/petRoutine";
import type { Species } from "../../pet/domain/pet";
import { t } from "../../../i18n/translations";

type Params = {
  activePetId: string;
  activePetSpecies: Species;
  databaseMode: boolean;
  livePetId: string | null;
  userId: string | null;
  fallbackPet: { id: string; species: Species };
  onNotice: (notice: string) => void;
  onSaved: () => void;
};

export function useRoutineDefaults({ activePetId, activePetSpecies, databaseMode, livePetId, userId, fallbackPet, onNotice, onSaved }: Params) {
  const routineQuery = usePetRoutine(livePetId, activePetSpecies, userId);
  const upsertRoutine = useUpsertPetRoutine(livePetId, userId, activePetSpecies);
  const [localRoutine, setLocalRoutine] = useState(() => createDefaultPetRoutine(fallbackPet.id, fallbackPet.species));

  const activeRoutine = useMemo(() => {
    if (databaseMode) return routineQuery.data ?? createDefaultPetRoutine(activePetId, activePetSpecies);
    if (localRoutine.petId === activePetId) return localRoutine;
    return createDefaultPetRoutine(activePetId, activePetSpecies);
  }, [activePetId, activePetSpecies, databaseMode, localRoutine, routineQuery.data]);

  async function saveRoutine(input: PetRoutineInput) {
    if (!databaseMode) {
      setLocalRoutine({ ...input, petId: activePetId });
      onNotice(t("ko", "routine.saved"));
      onSaved();
      return;
    }
    try {
      await upsertRoutine.mutateAsync(input);
      onNotice(t("ko", "routine.saved"));
      onSaved();
    } catch (error) {
      onNotice(t("ko", "routine.saveFailed"));
      throw error;
    }
  }

  return { activeRoutine, saveRoutine };
}
