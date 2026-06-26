import { useCallback, type Dispatch, type SetStateAction } from "react";
import { type User } from "@supabase/supabase-js";
import { type PetProfile } from "../../pet/domain/pet";
import { supabase } from "../infrastructure/supabaseClient";
import { createPetRow, updatePetRow, type CreatePetInput, type UpdatePetInput } from "./authContextQueries";

type AuthPetMutationState = {
  user: User | null;
  clearMessages: () => void;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setPets: Dispatch<SetStateAction<PetProfile[]>>;
  setActivePetId: Dispatch<SetStateAction<string | null>>;
  setAuthMessage: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
};

export function useAuthPetMutations({
  user,
  clearMessages,
  setLoading,
  setPets,
  setActivePetId,
  setAuthMessage,
  setError,
}: AuthPetMutationState) {
  const createPet = useCallback(
    async (input: CreatePetInput) => {
      const validationError = validatePetRequest(input);
      if (validationError) return validationError;

      setLoading(true);
      clearMessages();
      try {
        const nextPet = await createPetRow(supabase!, user!.id, input);
        setPets((current) => [nextPet, ...current.filter((pet) => pet.id !== nextPet.id)]);
        setActivePetId(nextPet.id);
        setAuthMessage("Pet added.");
        return null;
      } catch (rawError) {
        return handlePetError(rawError, "Could not create pet.", setError);
      } finally {
        setLoading(false);
      }
    },
    [clearMessages, setActivePetId, setAuthMessage, setError, setLoading, setPets, user],
  );

  const updatePet = useCallback(
    async (input: UpdatePetInput) => {
      const validationError = validatePetRequest(input);
      if (validationError) return validationError;

      setLoading(true);
      clearMessages();
      try {
        const nextPet = await updatePetRow(supabase!, input);
        setPets((current) => current.map((pet) => (pet.id === nextPet.id ? nextPet : pet)));
        setActivePetId(nextPet.id);
        setAuthMessage("Pet updated.");
        return null;
      } catch (rawError) {
        return handlePetError(rawError, "Could not update pet.", setError);
      } finally {
        setLoading(false);
      }
    },
    [clearMessages, setActivePetId, setAuthMessage, setError, setLoading, setPets, user],
  );

  return { createPet, updatePet };

  function validatePetRequest(input: CreatePetInput) {
    if (!supabase || !user) return "Authentication required.";
    if (!input.name.trim()) return "Pet name is required.";
    return null;
  }
}

function handlePetError(rawError: unknown, fallback: string, setError: Dispatch<SetStateAction<string | null>>) {
  const nextError = rawError instanceof Error ? rawError.message : fallback;
  setError(nextError);
  return nextError;
}
