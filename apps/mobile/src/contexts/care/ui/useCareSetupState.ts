import { useRef, useState } from "react";
import { useActiveCareSetup, useCreateCareSetup } from "../application/carePlanRecords";
import type { ActiveCareSetup, CareSetupInput } from "../domain/carePlan";
import { t } from "../../../i18n/translations";
import { errorNoticeText } from "../../../i18n/errorNotice";
import type { NoticeTone } from "../../../design-system/components";
import { buildNextLocalCareSetup } from "./careSetupLocalState";

type Params = {
  activePetId: string;
  databaseMode: boolean;
  livePetId: string | null;
  userId: string | null;
  onNotice: (notice: string, tone?: NoticeTone, source?: { hasInlineError?: boolean }) => void;
  onSaved: () => void;
};

export function useCareSetupState({ activePetId, databaseMode, livePetId, userId, onNotice, onSaved }: Params) {
  const livePetIdRef = useRef(livePetId);
  livePetIdRef.current = livePetId;
  const careSetupQuery = useActiveCareSetup(livePetId, userId);
  const createCareSetup = useCreateCareSetup(livePetId, userId);
  const [localCareSetups, setLocalCareSetups] = useState<Record<string, ActiveCareSetup>>({});
  // The ref includes accepted saves before React renders, so consecutive saves cannot lose a plan.
  const acceptedLocalSetups = useRef(localCareSetups);
  const lastLocalTimestamp = useRef(0);
  const activeCareSetup = databaseMode ? careSetupQuery.data ?? emptyActiveCareSetup() : localCareSetups[activePetId] ?? emptyActiveCareSetup();
  const careSetupStatus: "ready" | "loading" | "error" = !databaseMode ? "ready" : careSetupQuery.isError ? "error" : careSetupQuery.isLoading ? "loading" : "ready";
  function refetchCareSetup() {
    void careSetupQuery.refetch();
  }

  async function saveCareSetup(input: CareSetupInput): Promise<ActiveCareSetup> {
    if (!databaseMode) {
      const requestPetId = activePetId;
      const timestamp = Math.max(Date.now(), lastLocalTimestamp.current + 1);
      lastLocalTimestamp.current = timestamp;
      const nextSetup = buildNextLocalCareSetup(acceptedLocalSetups.current[requestPetId] ?? emptyActiveCareSetup(), input, timestamp);
      acceptedLocalSetups.current = { ...acceptedLocalSetups.current, [requestPetId]: nextSetup };
      setLocalCareSetups((current) => ({ ...current, [requestPetId]: nextSetup }));
      onNotice(t("care.setupSaved"));
      onSaved();
      return nextSetup;
    }

    try {
      const requestPetId = livePetId;
      const savedSetup = await createCareSetup.mutateAsync(input);
      if (livePetIdRef.current !== requestPetId) return savedSetup;
      onNotice(t("care.setupSaved"));
      onSaved();
      return savedSetup;
    } catch (error) {
      const message = errorNoticeText(error, "care.setupSaveFailed");
      onNotice(message, "error", { hasInlineError: true });
      throw error instanceof Error ? error : new Error(message);
    }
  }

  return { activeCareSetup, saveCareSetup, careSetupStatus, refetchCareSetup };
}

function emptyActiveCareSetup(): ActiveCareSetup {
  return { conditions: [], plans: [], schedules: [] };
}
