import { useCallback, useEffect, useMemo, useState } from "react";
import { type Session, type User } from "@supabase/supabase-js";
import { isSupabaseConfigured as configuredFromEnv } from "../../../shared-kernel/config";
import { supabase } from "../infrastructure/supabaseClient";
import { mapDbPet, type PetProfile } from "../../pet/domain/pet";
import type { AppAuthState } from "./authContextTypes";
import { useAuthPetMutations } from "./authPetMutations";
import { ensureProfileRow, loadPetRows } from "./authContextQueries";
import { authErrorTranslationKey } from "./authErrorMessages";
import type { IdentityMessageKey } from "./identityMessage";
import { useAuthActions } from "./useAuthActions";

export function useAuthState() {
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [activePetId, setActivePetId] = useState<string | null>(null);
  const [error, setError] = useState<IdentityMessageKey | null>(null);
  const [authMessage, setAuthMessage] = useState<IdentityMessageKey | null>(null);

  const activePet = useMemo(() => pets.find((pet) => pet.id === activePetId) ?? pets[0] ?? null, [pets, activePetId]);

  const clearMessages = useCallback(() => {
    setError(null);
    setAuthMessage(null);
  }, []);

  const loadPets = useCallback(async () => {
    const client = supabase;
    if (!client) {
      return;
    }

    try {
      const rows = await loadPetRows(client);
      const nextPets = rows.map((row) => mapDbPet(row));
      setPets(nextPets);

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
      setError("pet.loadFailed");
    }
  }, []);

  useEffect(() => {
    if (!configuredFromEnv || !supabase) {
      setInitialized(true);
      return;
    }

    const client = supabase;
    if (!client) {
      setInitialized(true);
      return;
    }

    const initialize = async () => {
      const { data, error: sessionError } = await client.auth.getSession();
      if (sessionError) {
        setError(authErrorTranslationKey(sessionError));
      }

      const currentSession = data.session;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        await loadPets();
      }
      setInitialized(true);
    };

    void initialize();

    const { data: listener } = client.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        try {
          await ensureProfileRow(client, nextSession.user);
          await loadPets();
        } catch {
          setError("auth.error.generic");
        }
      } else {
        setPets([]);
        setActivePetId(null);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [loadPets]);

  const { signIn, signUp, signOut } = useAuthActions({
    clearMessages,
    setLoading,
    setSession,
    setUser,
    setPets,
    setActivePetId,
    setAuthMessage,
    setError,
  });

  const { createPet, updatePet, deletePet } = useAuthPetMutations({
    user,
    clearMessages,
    setLoading,
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
    resetMessage: clearMessages,
  } satisfies AppAuthState;
}
