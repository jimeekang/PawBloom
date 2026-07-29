import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { PetProfile } from "../../pet/domain/pet";
import { supabase } from "../infrastructure/supabaseClient";
import { ensureProfileRow } from "./authContextQueries";
import { authErrorTranslationKey } from "./authErrorMessages";
import { authSignUpOutcome } from "./authSignUpPolicy";
import { changeAuthenticatedPassword } from "./changeAuthenticatedPassword";
import { getPasswordResetRedirectUrl } from "./passwordRecoveryLink";
import type { IdentityMessageKey } from "./identityMessage";

type AuthActionState = {
  currentEmail: string | null;
  clearMessages: () => void;
  onSignedOut: () => void;
  onSignOutStarted: () => void;
  onSignOutAborted: () => void;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setSession: Dispatch<SetStateAction<Session | null>>;
  setUser: Dispatch<SetStateAction<User | null>>;
  setPets: Dispatch<SetStateAction<PetProfile[]>>;
  setActivePetId: Dispatch<SetStateAction<string | null>>;
  setAuthMessage: Dispatch<SetStateAction<IdentityMessageKey | null>>;
  setError: Dispatch<SetStateAction<IdentityMessageKey | null>>;
};

export function useAuthActions({
  currentEmail,
  clearMessages,
  onSignedOut,
  onSignOutStarted,
  onSignOutAborted,
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

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!supabase) {
      setError("auth.clientMissing");
      return "auth.clientMissing" as const;
    }
    if (actionInFlight.current) return "auth.wait" as const;

    actionInFlight.current = true;
    setLoading(true);
    clearMessages();
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: getPasswordResetRedirectUrl(),
      });
      if (error) {
        const messageKey = authErrorTranslationKey(error);
        setError(messageKey);
        return messageKey;
      }

      setAuthMessage("auth.resetEmailSent");
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

  const updatePassword = useCallback(async (password: string) => {
    if (!supabase) {
      setError("auth.clientMissing");
      return "auth.clientMissing" as const;
    }
    if (actionInFlight.current) return "auth.wait" as const;

    actionInFlight.current = true;
    setLoading(true);
    clearMessages();
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        const messageKey = authErrorTranslationKey(error);
        setError(messageKey);
        return messageKey;
      }

      // The recovery gate stays open — PasswordRecoveryScreen shows the
      // success state and the user leaves it explicitly (review: the banner
      // would otherwise vanish into the shell, which never renders authMessage).
      setAuthMessage("auth.resetDone");
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

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const client = supabase;
    if (!client) return "auth.clientMissing" as const;
    if (!currentEmail) return "auth.error.generic" as const;
    if (actionInFlight.current) return "auth.wait" as const;

    actionInFlight.current = true;
    setLoading(true);
    clearMessages();
    try {
      const error = await changeAuthenticatedPassword({
        reauthenticate: async () => {
          const result = await client.auth.signInWithPassword({
            email: currentEmail.trim().toLowerCase(),
            password: currentPassword,
          });
          return { error: result.error };
        },
        updatePassword: async () => {
          const result = await client.auth.updateUser({ password: newPassword });
          return { error: result.error };
        },
      });
      return error ? authErrorTranslationKey(error) : null;
    } catch (rawError) {
      return authErrorTranslationKey(rawError);
    } finally {
      actionInFlight.current = false;
      setLoading(false);
    }
  }, [clearMessages, currentEmail, setLoading]);

  const signOut = useCallback(async () => {
    if (!supabase || actionInFlight.current) return;

    clearMessages();
    actionInFlight.current = true;
    setLoading(true);
    // Raise the explicit-sign-out flag before the call: auth-js runs the
    // SIGNED_OUT callback synchronously inside this await, and the session
    // sync would otherwise misread the event as an expiry (B1).
    onSignOutStarted();
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        onSignOutAborted();
        setError(authErrorTranslationKey(error));
        return;
      }

      onSignedOut();
      setSession(null);
      setUser(null);
      setPets([]);
      setActivePetId(null);
    } catch (rawError) {
      onSignOutAborted();
      setError(authErrorTranslationKey(rawError));
    } finally {
      actionInFlight.current = false;
      setLoading(false);
    }
  }, [clearMessages, onSignedOut, onSignOutAborted, onSignOutStarted, setActivePetId, setError, setLoading, setPets, setSession, setUser]);

  return { signIn, signUp, signOut, requestPasswordReset, updatePassword, changePassword };
}
