import { useQuery, useQueryClient } from "@tanstack/react-query";
import { normalizeAppearance, type Appearance, type CharacterSpecies } from "../domain/appearance";
import { previewAppearance, readAppearance, saveAppearance } from "./appearanceRepository";

export function usePetAppearance(userId: string | null, petId: string, species: CharacterSpecies) {
  const client = useQueryClient();
  const queryKey = ["appearance", userId, petId, species] as const;
  const query = useQuery({ queryKey, queryFn: () => readAppearance(userId, petId, species), initialData: userId === null ? () => previewAppearance(petId, species) : undefined, staleTime: Infinity, retry: false });
  return {
    appearance: query.data ?? (userId ? normalizeAppearance(null, species) : previewAppearance(petId, species)),
    loading: query.isPending,
    failed: query.isError,
    retry: query.refetch,
    save: async (appearance: Appearance) => {
      const saved = await saveAppearance(userId, petId, species, appearance);
      await client.cancelQueries({ queryKey, exact: true });
      client.setQueryData(queryKey, saved);
    },
  };
}
