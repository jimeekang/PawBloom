import { useCallback, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { type Session, type User } from "@supabase/supabase-js";
import { isSupabaseConfigured as configuredFromEnv } from "../../../shared-kernel/config";
import { supabase } from "../infrastructure/supabaseClient";
import { mapDbPet, type PetProfile } from "../../pet/domain/pet";
import type { AppAuthState } from "./authContextTypes";
import { useAuthPetMutations } from "./authPetMutations";
import { loadPetRows } from "./authContextQueries";
import type { IdentityMessageKey } from "./identityMessage";
import { useAuthActions } from "./useAuthActions";
import { useAuthSessionSync } from "./useAuthSessionSync";
import { clearAccountScopedQueryCache, isCurrentAccountWork } from "./authAccountBoundary";
import { cancelMedicationRemindersForAccount, setActiveMedicationReminderAccount } from "../../medication/application/medicationReminderNotifications";
import { cancelMealRemindersForAccount, setActiveMealReminderAccount } from "../../routine/application/mealReminderNotifications";
import { usePendingMediaCleanupRetry } from "./usePendingMediaCleanupRetry";
export function useAuthState() {
  const [initialized, setInitialized] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [petMutationLoading, setPetMutationLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [activePetId, setActivePetId] = useState<string | null>(null);
  const [petLoadStatus, setPetLoadStatus] = useState<AppAuthState["petLoadStatus"]>("idle");
  const [error, setError] = useState<IdentityMessageKey | null>(null);
  const [authMessage, setAuthMessage] = useState<IdentityMessageKey | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const explicitSignOutRef = useRef(false);
  const petLoadRevisionRef = useRef(0);
  const petListReadyRef = useRef(false);
  const queryClient = useQueryClient();
  const activePet = useMemo(() => pets.find((pet) => pet.id === activePetId) ?? pets[0] ?? null, [pets, activePetId]);
  const loading = authLoading || petMutationLoading;

  const clearMessages = useCallback(() => {
    setError(null);
    setAuthMessage(null);
  }, []);

  const loadPets = useCallback(async (userId: string, blocking = true) => {
    const requestRevision = ++petLoadRevisionRef.current;
    const isCurrentRequest = () => isCurrentAccountWork(activeUserIdRef.current, userId, petLoadRevisionRef.current, requestRevision);
    const shouldBlock = blocking || !petListReadyRef.current;
    const client = supabase;
    if (!client) {
      if (isCurrentRequest()) {
        if (shouldBlock) setPetLoadStatus("error");
        setError("pet.loadFailed");
      }
      return;
    }

    if (shouldBlock && isCurrentRequest()) {
      setPetLoadStatus("loading");
      setError((current) => current === "pet.loadFailed" ? null : current);
    }
    try {
      const rows = await loadPetRows(client, userId);
      if (!isCurrentRequest()) return;
      const nextPets = rows.map(({ membershipRole, ...row }) => mapDbPet(row, membershipRole));
      petListReadyRef.current = true;
      setPets(nextPets);
      setPetLoadStatus("ready");
      setError((current) => current === "pet.loadFailed" ? null : current);

      if (nextPets.length === 0) {
        setActivePetId(null);
        return;
      }

      setActivePetId((current) => {
        if (current && nextPets.some((pet) => pet.id === current)) {
          return current;
        }
        return nextPets[0]?.id ?? null;
      });
    } catch {
      if (isCurrentRequest()) {
        if (shouldBlock) {
          petListReadyRef.current = false;
          setPetLoadStatus("error");
        }
        setError("pet.loadFailed");
      }
    }
  }, []);

  const retryPetLoad = useCallback(() => {
    const userId = activeUserIdRef.current;
    if (userId) void loadPets(userId);
  }, [loadPets]);
  const getActiveUserId = useCallback(() => activeUserIdRef.current, []);
  const updateAccountBoundary = useCallback((nextUserId: string | null) => {
    const previousUserId = activeUserIdRef.current;
    const changed = clearAccountScopedQueryCache(queryClient, previousUserId, nextUserId);
    activeUserIdRef.current = nextUserId;
    if (changed) {
      petLoadRevisionRef.current += 1;
      petListReadyRef.current = false;
      setActiveMedicationReminderAccount(nextUserId);
      setActiveMealReminderAccount(nextUserId);
      if (previousUserId) {
        void cancelMedicationRemindersForAccount(previousUserId).catch(() => undefined);
        void cancelMealRemindersForAccount(previousUserId).catch(() => undefined);
      }
      setPets([]);
      setActivePetId(null);
      setPetLoadStatus(nextUserId ? "loading" : "idle");
    }
    return changed;
  }, [queryClient]);
  const handleSignedOut = useCallback(() => {
    explicitSignOutRef.current = true;
    updateAccountBoundary(null);
  }, [updateAccountBoundary]);

  useAuthSessionSync({
    activeUserIdRef,
    explicitSignOutRef,
    loadPets,
    updateAccountBoundary,
    setSession,
    setUser,
    setInitialized,
    setPetLoadStatus,
    setError,
    setAuthMessage,
  });

  usePendingMediaCleanupRetry(user?.id ?? null);

  const { signIn, signUp, signOut } = useAuthActions({
    clearMessages,
    onSignedOut: handleSignedOut,
    setLoading: setAuthLoading,
    setSession,
    setUser,
    setPets,
    setActivePetId,
    setAuthMessage,
    setError,
  });

  const { createPet, updatePet, deletePet } = useAuthPetMutations({
    user,
    getActiveUserId,
    clearMessages,
    setLoading: setPetMutationLoading,
    setPets,
    setActivePetId,
    setAuthMessage,
    setError,
  });

  const selectPet = useCallback((petId: string) => {
    setActivePetId(petId);
  }, []);

  const selectNextPet = useCallback(() => {
    if (pets.length <= 1) {
      return;
    }

    const currentIndex = pets.findIndex((pet) => pet.id === activePetId);
    const nextIndex = (currentIndex + 1) % pets.length;
    const nextPet = pets[nextIndex] ?? pets[0];
    if (nextPet) {
      setActivePetId(nextPet.id);
    }
  }, [activePetId, pets]);

  return {
    configured: configuredFromEnv,
    initialized,
    loading,
    session,
    user,
    pets,
    activePet,
    petLoadStatus,
    error,
    authMessage,
    signIn,
    signUp,
    signOut,
    createPet,
    updatePet,
    deletePet,
    selectPet,
    selectNextPet,
    retryPetLoad,
    resetMessage: clearMessages,
  } satisfies AppAuthState;
}
