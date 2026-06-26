import { useCallback, useEffect, useMemo, useState } from "react";
import { type Session, type User } from "@supabase/supabase-js";
import { isSupabaseConfigured as configuredFromEnv } from "../../../shared-kernel/config";
import { supabase } from "../infrastructure/supabaseClient";
import { mapDbPet, type PetProfile } from "../../pet/domain/pet";
import type { AppAuthState } from "./authContextTypes";
import { useAuthPetMutations } from "./authPetMutations";
import { ensureProfileRow, loadPetRows } from "./authContextQueries";

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
      setError(rawError instanceof Error ? rawError.message : "반려동물 목록을 불러오지 못했습니다.");
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
      return "Supabase 클라이언트가 설정되어 있지 않습니다.";
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

    setAuthMessage("로그인되었습니다.");
    return null;
  }, [clearMessages]);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      return "Supabase 클라이언트가 설정되어 있지 않습니다.";
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
      setAuthMessage("회원가입이 완료되었습니다.");
      return null;
    }

    if (data.user) {
      setAuthMessage("회원가입 확인을 위해 이메일을 확인해 주세요.");
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
