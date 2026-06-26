import { useCallback, type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { type User } from "@supabase/supabase-js";
import { type PetProfile } from "../../pet/domain/pet";
import { supabase } from "../infrastructure/supabaseClient";
import { createPetRow, deletePetRow, updatePetRow, uploadPetProfilePhoto, type CreatePetInput, type UpdatePetInput } from "./authContextQueries";

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
  const queryClient = useQueryClient();

  const createPet = useCallback(
    async (input: CreatePetInput) => {
      const validationError = validatePetRequest(input);
      if (validationError) return validationError;

      setLoading(true);
      clearMessages();
      try {
        const createdPet = await createPetRow(supabase!, user!.id, input);
        if (input.profilePhoto) {
          await uploadPetProfilePhoto(supabase!, user!.id, createdPet.id, input.profilePhoto);
          void queryClient.invalidateQueries({ queryKey: ["pet-profile-photo-url", createdPet.id] });
        }
        setPets((current) => [createdPet, ...current.filter((pet) => pet.id !== createdPet.id)]);
        setActivePetId(createdPet.id);
        setAuthMessage("반려동물 프로필이 추가되었습니다.");
        return null;
      } catch (rawError) {
        return handlePetError(rawError, "반려동물 프로필을 추가하지 못했습니다.", setError);
      } finally {
        setLoading(false);
      }
    },
    [clearMessages, queryClient, setActivePetId, setAuthMessage, setError, setLoading, setPets, user],
  );

  const updatePet = useCallback(
    async (input: UpdatePetInput) => {
      const validationError = validatePetRequest(input);
      if (validationError) return validationError;

      setLoading(true);
      clearMessages();
      try {
        const nextPet = await updatePetRow(supabase!, input);
        if (input.profilePhoto) {
          await uploadPetProfilePhoto(supabase!, user!.id, input.id, input.profilePhoto);
          void queryClient.invalidateQueries({ queryKey: ["pet-profile-photo-url", input.id] });
        }
        setPets((current) => current.map((pet) => (pet.id === nextPet.id ? nextPet : pet)));
        setActivePetId(nextPet.id);
        setAuthMessage("반려동물 프로필이 수정되었습니다.");
        return null;
      } catch (rawError) {
        return handlePetError(rawError, "반려동물 프로필을 수정하지 못했습니다.", setError);
      } finally {
        setLoading(false);
      }
    },
    [clearMessages, queryClient, setActivePetId, setAuthMessage, setError, setLoading, setPets, user],
  );

  const deletePet = useCallback(
    async (petId: string) => {
      const validationError = validateDeleteRequest(petId);
      if (validationError) return validationError;

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
        setAuthMessage("반려동물 프로필이 삭제되었습니다.");
        return null;
      } catch (rawError) {
        return handlePetError(rawError, "반려동물 프로필을 삭제하지 못했습니다.", setError);
      } finally {
        setLoading(false);
      }
    },
    [clearMessages, setActivePetId, setAuthMessage, setError, setLoading, setPets, user],
  );

  return { createPet, updatePet, deletePet };

  function validatePetRequest(input: CreatePetInput) {
    if (!supabase || !user) return "로그인이 필요합니다.";
    if (!input.name.trim()) return "반려동물 이름은 필수입니다.";
    return null;
  }

  function validateDeleteRequest(petId: string) {
    if (!supabase || !user) return "로그인이 필요합니다.";
    if (!petId) return "반려동물 프로필이 필요합니다.";
    return null;
  }
}

function handlePetError(rawError: unknown, fallback: string, setError: Dispatch<SetStateAction<string | null>>) {
  const nextError = rawError instanceof Error ? rawError.message : fallback;
  setError(nextError);
  return nextError;
}
