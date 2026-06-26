import { useCallback, useEffect, useMemo, useState } from "react";
import { type Session, type User } from "@supabase/supabase-js";
import { isSupabaseConfigured as configuredFromEnv } from "../../../shared-kernel/config";
import { supabase } from "../infrastructure/supabaseClient";
import { mapDbPet, type PetProfile } from "../../pet/domain/pet";
import type { AppAuthState } from "./authContextTypes";
import {
  createPetRow,
  CreatePetInput,
  ensureProfileRow,
  loadPetRows,
} from "./authContextQueries";

export function useAuthState() {
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [activePetId, setActivePetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

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
    } catch (rawError) {
      setError(rawError instanceof Error ? rawError.message : "Could not load pets.");
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
        setError(sessionError.message);
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
        await ensureProfileRow(client, nextSession.user);
        await loadPets();
      } else {
        setPets([]);
        setActivePetId(null);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [loadPets]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      return "Supabase client is not configured";
    }

    setLoading(true);
    clearMessages();

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return error.message;
    }

    setAuthMessage("Sign in successful.");
    return null;
  }, [clearMessages]);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      return "Supabase client is not configured";
    }

    setLoading(true);
    clearMessages();

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return error.message;
    }

    if (data.user) {
      await ensureProfileRow(supabase, data.user);
    }

    if (data.user && data.session) {
      setAuthMessage("Sign up complete.");
      return null;
    }

    if (data.user) {
      setAuthMessage("Check your email to confirm signup.");
    }

    return null;
  }, [clearMessages]);

  const signOut = useCallback(async () => {
    if (!supabase) {
      return;
    }

    clearMessages();
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    setSession(null);
    setUser(null);
    setPets([]);
    setActivePetId(null);
  }, [clearMessages]);

  const createPet = useCallback(
    async (input: CreatePetInput) => {
      if (!supabase || !user) {
        return "Authentication required.";
      }

      if (!input.name.trim()) {
        return "Pet name is required.";
      }

      setLoading(true);
      clearMessages();

      try {
        const nextPet = await createPetRow(supabase, user.id, input);
        setPets((current) => [nextPet, ...current.filter((pet) => pet.id !== nextPet.id)]);
        setActivePetId(nextPet.id);
        setAuthMessage("Pet added.");
        return null;
      } catch (rawError) {
        const nextError = rawError instanceof Error ? rawError.message : "Could not create pet.";
        setError(nextError);
        return nextError;
      } finally {
        setLoading(false);
      }
    },
    [clearMessages, user],
  );

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
    selectPet,
    selectNextPet,
    resetMessage: clearMessages,
  } satisfies AppAuthState;
}
