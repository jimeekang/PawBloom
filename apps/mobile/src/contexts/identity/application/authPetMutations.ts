import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { type User } from "@supabase/supabase-js";
import { type PetProfile } from "../../pet/domain/pet";
import { supabase } from "../infrastructure/supabaseClient";
import { createPetRow, deletePetRow, updatePetRow, uploadPetProfilePhoto, type CreatePetInput, type UpdatePetInput } from "./authContextQueries";
import { savePetProfileWithOptionalPhoto } from "./petProfileSavePolicy";
import { petDeleteValidationKey, petProfileValidationKey } from "./petProfileValidation";
import type { IdentityMessageKey } from "./identityMessage";

type AuthPetMutationState = {
  user: User | null;
  clearMessages: () => void;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setPets: Dispatch<SetStateAction<PetProfile[]>>;
  setActivePetId: Dispatch<SetStateAction<string | null>>;
  setAuthMessage: Dispatch<SetStateAction<IdentityMessageKey | null>>;
  setError: Dispatch<SetStateAction<IdentityMessageKey | null>>;
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
  const queryClient = useQueryClient();
  const mutationInFlight = useRef(false);

  const createPet = useCallback(
    async (input: CreatePetInput) => {
      const validationError = validatePetRequest(input);
      if (validationError) {
        clearMessages();
        setError(validationError);
        return validationError;
      }
      if (mutationInFlight.current) return "auth.wait";

      mutationInFlight.current = true;
      setLoading(true);
      clearMessages();
      try {
        const result = await savePetProfileWithOptionalPhoto({
          saveProfile: () => createPetRow(supabase!, user!.id, input),
          savePhoto: input.profilePhoto
            ? (createdPet) => uploadPetProfilePhoto(supabase!, user!.id, createdPet.id, input.profilePhoto!)
            : undefined,
        });
        const createdPet = result.profile;
        setPets((current) => [createdPet, ...current.filter((pet) => pet.id !== createdPet.id)]);
        setActivePetId(createdPet.id);
        if (result.photoSaved) void queryClient.invalidateQueries({ queryKey: ["pet-profile-photo-url", createdPet.id] });
        setAuthMessage(result.photoError ? "pet.photoPartial" : "pet.created");
        return null;
      } catch (rawError) {
        return handlePetError(rawError, "pet.createFailed", setError);
      } finally {
        mutationInFlight.current = false;
        setLoading(false);
      }
    },
    [clearMessages, queryClient, setActivePetId, setAuthMessage, setError, setLoading, setPets, user],
  );

  const updatePet = useCallback(
    async (input: UpdatePetInput) => {
      const validationError = validatePetRequest(input);
      if (validationError) {
        clearMessages();
        setError(validationError);
        return validationError;
      }
      if (mutationInFlight.current) return "auth.wait";

      mutationInFlight.current = true;
      setLoading(true);
      clearMessages();
      try {
        const result = await savePetProfileWithOptionalPhoto({
          saveProfile: () => updatePetRow(supabase!, input),
          savePhoto: input.profilePhoto ? () => uploadPetProfilePhoto(supabase!, user!.id, input.id, input.profilePhoto!) : undefined,
        });
        const nextPet = result.profile;
        setPets((current) => current.map((pet) => (pet.id === nextPet.id ? nextPet : pet)));
        setActivePetId(nextPet.id);
        if (result.photoSaved) void queryClient.invalidateQueries({ queryKey: ["pet-profile-photo-url", input.id] });
        setAuthMessage(result.photoError ? "pet.photoPartial" : "pet.updated");
        return null;
      } catch (rawError) {
        return handlePetError(rawError, "pet.updateFailed", setError);
      } finally {
        mutationInFlight.current = false;
        setLoading(false);
      }
    },
    [clearMessages, queryClient, setActivePetId, setAuthMessage, setError, setLoading, setPets, user],
  );

  const deletePet = useCallback(
    async (petId: string) => {
      const validationError = validateDeleteRequest(petId);
      if (validationError) {
        clearMessages();
        setError(validationError);
        return validationError;
      }
      if (mutationInFlight.current) return "auth.wait";

      mutationInFlight.current = true;
      setLoading(true);
      clearMessages();
      try {
        await deletePetRow(supabase!, petId);
        setPets((current) => {
          const nextPets = current.filter((pet) => pet.id !== petId);
          setActivePetId((currentActivePetId) => {
            if (currentActivePetId && currentActivePetId !== petId) {
              return currentActivePetId;
            }
            return nextPets[0]?.id ?? null;
          });
          return nextPets;
        });
        setAuthMessage("pet.deleted");
        return null;
      } catch (rawError) {
        return handlePetError(rawError, "pet.deleteFailed", setError);
      } finally {
        mutationInFlight.current = false;
        setLoading(false);
      }
    },
    [clearMessages, setActivePetId, setAuthMessage, setError, setLoading, setPets, user],
  );

  return { createPet, updatePet, deletePet };

  function validatePetRequest(input: CreatePetInput) {
    return petProfileValidationKey({ configured: Boolean(supabase), userPresent: Boolean(user), name: input.name });
  }

  function validateDeleteRequest(petId: string) {
    return petDeleteValidationKey({ configured: Boolean(supabase), userPresent: Boolean(user), petId });
  }
}

function handlePetError(_rawError: unknown, fallback: IdentityMessageKey, setError: Dispatch<SetStateAction<IdentityMessageKey | null>>) {
  setError(fallback);
  return fallback;
}
