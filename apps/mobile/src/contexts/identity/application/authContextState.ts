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
import { usePasswordRecoveryLink } from "./passwordRecoveryLink";
import { clearAccountScopedQueryCache, isCurrentAccountWork } from "./authAccountBoundary";
import { cancelMedicationRemindersForAccount, setActiveMedicationReminderAccount } from "../../medication/application/medicationReminderNotifications";
import { cancelMealRemindersForAccount, setActiveMealReminderAccount } from "../../routine/application/mealReminderNotifications";
import { usePendingMediaCleanupRetry } from "./usePendingMediaCleanupRetry";
const locallyDeletedUserIds = new Set<string>();
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
  const [passwordRecoveryActive, setPasswordRecoveryActive] = useState(false);
  const activeUserIdRef = useRef<string | null>(null);
  // A provider remount must not let a delayed auth-js event reopen an account
  // that this app process already deleted authoritatively.
  const locallyDeletedUserIdsRef = useRef(locallyDeletedUserIds);
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

  // Set after sign-out completes so it wins over any message the SIGNED_OUT
  // auth callback wrote while the session was being torn down.
  const announceAccountDeleted = useCallback(() => {
    setError(null);
    setAuthMessage("auth.accountDeleted");
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
      // Any account change (sign-out or switch) invalidates a pending recovery
      // gate; a fresh recovery link re-activates it after its own setSession.
      setPasswordRecoveryActive(false);
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
  // The explicit-sign-out flag is raised before supabase.auth.signOut() runs
  // (its SIGNED_OUT callback fires inside the await) and lowered again when
  // the call fails, so a later real expiry still notifies. The session sync
  // consumes and lowers the flag after each signed-out event.
  const beginExplicitSignOut = useCallback(() => {
    explicitSignOutRef.current = true;
  }, []);
  const abortExplicitSignOut = useCallback(() => {
    explicitSignOutRef.current = false;
  }, []);
  const handleSignedOut = useCallback(() => {
    updateAccountBoundary(null);
  }, [updateAccountBoundary]);

  useAuthSessionSync({
    activeUserIdRef,
    locallyDeletedUserIdsRef,
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
  const forceLocalAuthBoundary = useCallback((expectedUserId: string) => {
    locallyDeletedUserIdsRef.current.add(expectedUserId);
    if (activeUserIdRef.current !== expectedUserId) return false;
    // Account deletion is already authoritative on the server. Clear the
    // in-memory identity and account-scoped query cache synchronously even if
    // auth-js cannot remove its persisted local session afterward.
    updateAccountBoundary(null);
    setSession(null);
    setUser(null);
    setAuthLoading(false);
    setPetMutationLoading(false);
    return true;
  }, [updateAccountBoundary]);

  usePendingMediaCleanupRetry(user?.id ?? null);

  const beginPasswordRecovery = useCallback(() => setPasswordRecoveryActive(true), []);
  const endPasswordRecovery = useCallback(() => setPasswordRecoveryActive(false), []);
  usePasswordRecoveryLink({ activate: beginPasswordRecovery, setError });

  const { signIn, signUp, signOut, clearDeletedAccountLocalSession, requestPasswordReset, updatePassword, changePassword } = useAuthActions({
    currentEmail: user?.email ?? null,
    clearMessages,
    onSignedOut: handleSignedOut,
    onSignOutStarted: beginExplicitSignOut,
    onSignOutAborted: abortExplicitSignOut,
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
    passwordRecoveryActive,
    signIn,
    signUp,
    signOut,
    clearDeletedAccountLocalSession,
    requestPasswordReset,
    updatePassword,
    changePassword,
    cancelPasswordRecovery: endPasswordRecovery,
    createPet,
    updatePet,
    deletePet,
    selectPet,
    selectNextPet,
    retryPetLoad,
    resetMessage: clearMessages,
    forceLocalAuthBoundary,
    announceAccountDeleted,
  } satisfies AppAuthState;
}
