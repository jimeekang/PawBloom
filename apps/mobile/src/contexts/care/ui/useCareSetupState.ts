import { useState } from "react";
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
  const careSetupQuery = useActiveCareSetup(livePetId);
  const createCareSetup = useCreateCareSetup(livePetId, userId);
  const [localCareSetup, setLocalCareSetup] = useState<ActiveCareSetup>(() => emptyActiveCareSetup());
  const activeCareSetup = databaseMode ? careSetupQuery.data ?? emptyActiveCareSetup() : localCareSetup;

  function saveCareSetup(input: CareSetupInput) {
    if (!databaseMode) {
      setLocalCareSetup(buildNextLocalCareSetup(localCareSetup, input));
      onNotice(t("ko", "care.setupSaved"));
      onSaved();
      return;
    }
    void createCareSetup.mutateAsync(input).then(() => {
      onNotice(t("ko", "care.setupSaved"));
      onSaved();
    }).catch((error: Error) => onNotice(error.message));
  }

  return { activeCareSetup, saveCareSetup };
}

function emptyActiveCareSetup(): ActiveCareSetup {
  return { conditions: [], schedules: [] };
}
