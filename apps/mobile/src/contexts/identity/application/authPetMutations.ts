import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { type User } from "@supabase/supabase-js";
import { type PetProfile } from "../../pet/domain/pet";
import { supabase } from "../infrastructure/supabaseClient";
import { createPetRow, deletePetRow, updatePetRow, uploadPetProfilePhoto, type CreatePetInput, type UpdatePetInput } from "./authContextQueries";
import { savePetProfileWithOptionalPhoto } from "./petProfileSavePolicy";
import { petDeleteValidationKey, petProfileValidationKey } from "./petProfileValidation";
import type { IdentityMessageKey } from "./identityMessage";
import { isCurrentAccountWork } from "./authAccountBoundary";

type AuthPetMutationState = {
  user: User | null;
  getActiveUserId: () => string | null;
  clearMessages: () => void;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setPets: Dispatch<SetStateAction<PetProfile[]>>;
  setActivePetId: Dispatch<SetStateAction<string | null>>;
  setAuthMessage: Dispatch<SetStateAction<IdentityMessageKey | null>>;
  setError: Dispatch<SetStateAction<IdentityMessageKey | null>>;
};

export function useAuthPetMutations({
  user,
  getActiveUserId,
  clearMessages,
  setLoading,
  setPets,
  setActivePetId,
  setAuthMessage,
  setError,
}: AuthPetMutationState) {
  const queryClient = useQueryClient();
  const mutationInFlight = useRef(false);
  const mutationEpoch = useRef(0);
  const renderedUserId = useRef(user?.id ?? null);

  useEffect(() => {
    const nextUserId = user?.id ?? null;
    if (renderedUserId.current === nextUserId) return;
    renderedUserId.current = nextUserId;
    mutationEpoch.current += 1;
    mutationInFlight.current = false;
    setLoading(false);
  }, [setLoading, user?.id]);

  const createPet = useCallback(
    async (input: CreatePetInput) => {
      const validationError = validatePetRequest(input);
      if (validationError) {
        clearMessages();
        setError(validationError);
        return validationError;
      }
      if (mutationInFlight.current) return "auth.wait";

      const requestUserId = user?.id ?? null;
      const requestEpoch = mutationEpoch.current;
      mutationInFlight.current = true;
      setLoading(true);
      clearMessages();
      try {
        const result = await savePetProfileWithOptionalPhoto({
          saveProfile: () => createPetRow(supabase!, requestUserId!, input),
          savePhoto: input.profilePhoto
            ? (createdPet) => uploadPetProfilePhoto(supabase!, requestUserId!, createdPet.id, input.profilePhoto!)
            : undefined,
        });
        if (!isCurrentAccountWork(getActiveUserId(), requestUserId, mutationEpoch.current, requestEpoch)) return "auth.wait" as const;
        const createdPet = result.profile;
        setPets((current) => [createdPet, ...current.filter((pet) => pet.id !== createdPet.id)]);
        setActivePetId(createdPet.id);
        if (result.photoSaved) void queryClient.invalidateQueries({ queryKey: ["pet-profile-photo-url", createdPet.id, requestUserId] });
        setAuthMessage(result.photoError ? "pet.photoPartial" : "pet.created");
        return null;
      } catch (rawError) {
        if (!isCurrentAccountWork(getActiveUserId(), requestUserId, mutationEpoch.current, requestEpoch)) return "auth.wait" as const;
        return handlePetError(rawError, "pet.createFailed", setError);
      } finally {
        if (mutationEpoch.current === requestEpoch) {
          mutationInFlight.current = false;
          setLoading(false);
        }
      }
    },
    [clearMessages, getActiveUserId, queryClient, setActivePetId, setAuthMessage, setError, setLoading, setPets, user],
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

      const requestUserId = user?.id ?? null;
      const requestEpoch = mutationEpoch.current;
      mutationInFlight.current = true;
      setLoading(true);
      clearMessages();
      try {
        const result = await savePetProfileWithOptionalPhoto({
          saveProfile: () => updatePetRow(supabase!, input),
          savePhoto: input.profilePhoto ? () => uploadPetProfilePhoto(supabase!, requestUserId!, input.id, input.profilePhoto!) : undefined,
        });
        if (!isCurrentAccountWork(getActiveUserId(), requestUserId, mutationEpoch.current, requestEpoch)) return "auth.wait" as const;
        const nextPet = result.profile;
        setPets((current) => current.map((pet) => (pet.id === nextPet.id ? nextPet : pet)));
        setActivePetId(nextPet.id);
        if (result.photoSaved) void queryClient.invalidateQueries({ queryKey: ["pet-profile-photo-url", input.id, requestUserId] });
        setAuthMessage(result.photoError ? "pet.photoPartial" : "pet.updated");
        return null;
      } catch (rawError) {
        if (!isCurrentAccountWork(getActiveUserId(), requestUserId, mutationEpoch.current, requestEpoch)) return "auth.wait" as const;
        return handlePetError(rawError, "pet.updateFailed", setError);
      } finally {
        if (mutationEpoch.current === requestEpoch) {
          mutationInFlight.current = false;
          setLoading(false);
        }
      }
    },
    [clearMessages, getActiveUserId, queryClient, setActivePetId, setAuthMessage, setError, setLoading, setPets, user],
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

      const requestUserId = user?.id ?? null;
      const requestEpoch = mutationEpoch.current;
      mutationInFlight.current = true;
      setLoading(true);
      clearMessages();
      try {
        await deletePetRow(supabase!, petId);
        if (!isCurrentAccountWork(getActiveUserId(), requestUserId, mutationEpoch.current, requestEpoch)) return "auth.wait" as const;
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
        if (!isCurrentAccountWork(getActiveUserId(), requestUserId, mutationEpoch.current, requestEpoch)) return "auth.wait" as const;
        return handlePetError(rawError, "pet.deleteFailed", setError);
      } finally {
        if (mutationEpoch.current === requestEpoch) {
          mutationInFlight.current = false;
          setLoading(false);
        }
      }
    },
    [clearMessages, getActiveUserId, setActivePetId, setAuthMessage, setError, setLoading, setPets, user],
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
