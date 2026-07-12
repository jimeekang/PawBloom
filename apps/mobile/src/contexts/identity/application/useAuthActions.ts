import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { PetProfile } from "../../pet/domain/pet";
import { supabase } from "../infrastructure/supabaseClient";
import { ensureProfileRow } from "./authContextQueries";
import { authErrorTranslationKey } from "./authErrorMessages";
import { authSignUpOutcome } from "./authSignUpPolicy";
import type { IdentityMessageKey } from "./identityMessage";

type AuthActionState = {
  clearMessages: () => void;
  onSignedOut: () => void;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setSession: Dispatch<SetStateAction<Session | null>>;
  setUser: Dispatch<SetStateAction<User | null>>;
  setPets: Dispatch<SetStateAction<PetProfile[]>>;
  setActivePetId: Dispatch<SetStateAction<string | null>>;
  setAuthMessage: Dispatch<SetStateAction<IdentityMessageKey | null>>;
  setError: Dispatch<SetStateAction<IdentityMessageKey | null>>;
};

export function useAuthActions({
  clearMessages,
  onSignedOut,
  setLoading,
  setSession,
  setUser,
  setPets,
  setActivePetId,
  setAuthMessage,
  setError,
}: AuthActionState) {
  const actionInFlight = useRef(false);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      setError("auth.clientMissing");
      return "auth.clientMissing" as const;
    }
    if (actionInFlight.current) return "auth.wait" as const;

    actionInFlight.current = true;
    setLoading(true);
    clearMessages();
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) {
        const messageKey = authErrorTranslationKey(error);
        setError(messageKey);
        return messageKey;
      }

      setAuthMessage("auth.signedIn");
      return null;
    } catch (rawError) {
      const messageKey = authErrorTranslationKey(rawError);
      setError(messageKey);
      return messageKey;
    } finally {
      actionInFlight.current = false;
      setLoading(false);
    }
  }, [clearMessages, setAuthMessage, setError, setLoading]);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      setError("auth.clientMissing");
      return "auth.clientMissing" as const;
    }
    if (actionInFlight.current) return "auth.wait" as const;

    actionInFlight.current = true;
    setLoading(true);
    clearMessages();
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password });
      if (error) {
        const messageKey = authErrorTranslationKey(error);
        setError(messageKey);
        return messageKey;
      }

      const outcome = authSignUpOutcome({ hasUser: Boolean(data.user), hasSession: Boolean(data.session) });
      if (outcome.ensureProfile && data.user) await ensureProfileRow(supabase, data.user);
      if (outcome.messageKey) setAuthMessage(outcome.messageKey);
      return null;
    } catch (rawError) {
      const messageKey = authErrorTranslationKey(rawError);
      setError(messageKey);
      return messageKey;
    } finally {
      actionInFlight.current = false;
      setLoading(false);
    }
  }, [clearMessages, setAuthMessage, setError, setLoading]);

  const signOut = useCallback(async () => {
    if (!supabase || actionInFlight.current) return;

    clearMessages();
    actionInFlight.current = true;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setError(authErrorTranslationKey(error));
        return;
      }

      onSignedOut();
      setSession(null);
      setUser(null);
      setPets([]);
      setActivePetId(null);
    } catch (rawError) {
      setError(authErrorTranslationKey(rawError));
    } finally {
      actionInFlight.current = false;
      setLoading(false);
    }
  }, [clearMessages, onSignedOut, setActivePetId, setError, setLoading, setPets, setSession, setUser]);

  return { signIn, signUp, signOut };
}
