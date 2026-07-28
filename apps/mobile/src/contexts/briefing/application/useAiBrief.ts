import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "../../../shared-kernel/supabase/client";
import type { Language } from "../../../shared-kernel/types";
import type { AiBrief, AiBriefRangeDays } from "../domain/aiBrief";
import { parseGenerateAiBriefResponse } from "./aiBriefContract";

// Generates an AI brief for the active pet via the generate-ai-brief edge
// function. Pass petId=null (preview mode / no account) to disable generation.
// language selects the brief copy the edge function renders (KO/EN).
export function useAiBrief(petId: string | null, language: Language) {
  const mutation = useMutation<AiBrief, Error, AiBriefRangeDays>({
    mutationFn: async (rangeDays) => {
      const client = supabase;
      if (!client || !petId) throw new Error("AI brief service is not configured.");

      const { data, error } = await client.functions.invoke<unknown>("generate-ai-brief", {
        body: { petId, rangeDays, language },
      });
      if (error) throw error instanceof Error ? error : new Error("Failed to generate brief");
      return parseGenerateAiBriefResponse(data, petId);
    },
  });

  // A brief describes one pet over one range. Keeping the previous result after
  // either changes would attribute another pet's records to the current one.
  const { reset } = mutation;
  useEffect(() => {
    reset();
  }, [petId, reset]);

  return {
    brief: mutation.data ?? null,
    generating: mutation.isPending,
    failed: mutation.isError,
    generate: mutation.mutate,
    reset,
  };
}
