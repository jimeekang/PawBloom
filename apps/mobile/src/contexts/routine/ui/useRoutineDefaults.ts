import { useMemo, useState } from "react";
import { createDefaultPetRoutine, usePetRoutine, useUpsertPetRoutine } from "../application/petRoutineRecords";
import type { PetRoutineInput } from "../domain/petRoutine";
import type { Species } from "../../pet/domain/pet";
import { t } from "../../../i18n/translations";
import type { NoticeTone } from "../../../design-system/components";

type Params = {
  activePetId: string;
  activePetSpecies: Species;
  databaseMode: boolean;
  livePetId: string | null;
  userId: string | null;
  fallbackPet: { id: string; species: Species };
  onNotice: (notice: string, tone?: NoticeTone, source?: { hasInlineError?: boolean }) => void;
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

  // While the query is pending or failed, activeRoutine falls back to the
  // species defaults. Saving that back would overwrite the routine the user
  // actually has with defaults they never chose.
  const routineLoaded = !databaseMode || (!routineQuery.isLoading && !routineQuery.isError);

  async function saveRoutine(input: PetRoutineInput) {
    if (!routineLoaded) {
      onNotice(t("routine.saveBlockedUntilLoaded"), "error", { hasInlineError: true });
      throw new Error("routine.saveBlockedUntilLoaded");
    }
    if (!databaseMode) {
      setLocalRoutine({ ...input, petId: activePetId });
      onNotice(t("routine.saved"));
      onSaved();
      return;
    }
    try {
      await upsertRoutine.mutateAsync(input);
      onNotice(t("routine.saved"));
      onSaved();
    } catch (error) {
      onNotice(t("routine.saveFailed"), "error", { hasInlineError: true });
      throw error;
    }
  }

  return { activeRoutine, saveRoutine, routineLoaded };
}
