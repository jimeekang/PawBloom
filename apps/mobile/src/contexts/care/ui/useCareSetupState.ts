import { useRef, useState } from "react";
import { useActiveCareSetup, useCreateCareSetup } from "../application/carePlanRecords";
import type { ActiveCareSetup, CareSetupInput } from "../domain/carePlan";
import { t } from "../../../i18n/translations";
import { buildNextLocalCareSetup } from "./careSetupLocalState";

type Params = {
  databaseMode: boolean;
  livePetId: string | null;
  userId: string | null;
  onNotice: (notice: string) => void;
  onSaved: () => void;
};

export function useCareSetupState({ databaseMode, livePetId, userId, onNotice, onSaved }: Params) {
  const livePetIdRef = useRef(livePetId);
  livePetIdRef.current = livePetId;
  const careSetupQuery = useActiveCareSetup(livePetId, userId);
  const createCareSetup = useCreateCareSetup(livePetId, userId);
  const [localCareSetup, setLocalCareSetup] = useState<ActiveCareSetup>(() => emptyActiveCareSetup());
  const activeCareSetup = databaseMode ? careSetupQuery.data ?? emptyActiveCareSetup() : localCareSetup;
  const careSetupStatus: "ready" | "loading" | "error" = !databaseMode ? "ready" : careSetupQuery.isError ? "error" : careSetupQuery.isLoading ? "loading" : "ready";
  function refetchCareSetup() {
    void careSetupQuery.refetch();
  }

  async function saveCareSetup(input: CareSetupInput): Promise<ActiveCareSetup> {
    if (!databaseMode) {
      const nextSetup = buildNextLocalCareSetup(localCareSetup, input);
      setLocalCareSetup(nextSetup);
      onNotice(t("ko", "care.setupSaved"));
      onSaved();
      return nextSetup;
    }

    try {
      const requestPetId = livePetId;
      const savedSetup = await createCareSetup.mutateAsync(input);
      if (livePetIdRef.current !== requestPetId) return savedSetup;
      onNotice(t("ko", "care.setupSaved"));
      onSaved();
      return savedSetup;
    } catch (error) {
      const message = error instanceof Error ? error.message : t("ko", "care.setupSaveFailed");
      onNotice(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }

  return { activeCareSetup, saveCareSetup, careSetupStatus, refetchCareSetup };
}

function emptyActiveCareSetup(): ActiveCareSetup {
  return { conditions: [], plans: [], schedules: [] };
}
