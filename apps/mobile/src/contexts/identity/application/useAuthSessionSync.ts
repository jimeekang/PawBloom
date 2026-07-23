import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { type Session, type User } from "@supabase/supabase-js";
import { isSupabaseConfigured as configuredFromEnv } from "../../../shared-kernel/config";
import { supabase } from "../infrastructure/supabaseClient";
import { ensureProfileRow } from "./authContextQueries";
import { authErrorTranslationKey } from "./authErrorMessages";
import type { IdentityMessageKey } from "./identityMessage";
import type { AppAuthState } from "./authContextTypes";

type Params = {
  activeUserIdRef: MutableRefObject<string | null>;
  explicitSignOutRef: MutableRefObject<boolean>;
  loadPets: (userId: string, blocking?: boolean) => Promise<void>;
  updateAccountBoundary: (nextUserId: string | null) => boolean;
  setSession: Dispatch<SetStateAction<Session | null>>;
  setUser: Dispatch<SetStateAction<User | null>>;
  setInitialized: Dispatch<SetStateAction<boolean>>;
  setPetLoadStatus: Dispatch<SetStateAction<AppAuthState["petLoadStatus"]>>;
  setError: Dispatch<SetStateAction<IdentityMessageKey | null>>;
  setAuthMessage: Dispatch<SetStateAction<IdentityMessageKey | null>>;
};

export function useAuthSessionSync({ activeUserIdRef, explicitSignOutRef, loadPets, updateAccountBoundary, setSession, setUser, setInitialized, setPetLoadStatus, setError, setAuthMessage }: Params) {
  useEffect(() => {
    if (!configuredFromEnv || !supabase) {
      setInitialized(true);
      setPetLoadStatus("ready");
      return;
    }

    const client = supabase;
    let active = true;
    let authRevision = 0;
    const synchronizeUser = async (nextUser: User, blocking: boolean) => {
      try {
        await ensureProfileRow(client, nextUser);
      } catch {
        if (active && activeUserIdRef.current === nextUser.id) setError("auth.error.generic");
      }
      if (active && activeUserIdRef.current === nextUser.id) await loadPets(nextUser.id, blocking);
    };
    const scheduleUserSynchronization = (nextUser: User, revision = authRevision, blocking = true) => {
      setTimeout(() => {
        if (active && revision === authRevision && activeUserIdRef.current === nextUser.id) {
          void synchronizeUser(nextUser, blocking);
        }
      }, 0);
    };
    const initialize = async () => {
      const revisionAtStart = authRevision;
      try {
        const { data, error: sessionError } = await client.auth.getSession();
        if (!active) return;
        if (revisionAtStart !== authRevision) {
          setInitialized(true);
          return;
        }
        if (sessionError) setError(authErrorTranslationKey(sessionError));
        const currentSession = data.session;
        const accountChanged = updateAccountBoundary(currentSession?.user.id ?? null);
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setInitialized(true);
        if (currentSession?.user) scheduleUserSynchronization(currentSession.user, revisionAtStart, accountChanged);
      } catch (sessionError) {
        if (!active) return;
        if (revisionAtStart !== authRevision) {
          setInitialized(true);
          return;
        }
        updateAccountBoundary(null);
        setSession(null);
        setUser(null);
        setError(authErrorTranslationKey(sessionError));
        setInitialized(true);
      }
    };

    void initialize();

    const { data: listener } = client.auth.onAuthStateChange((event, nextSession) => {
      authRevision += 1;
      const revision = authRevision;
      const hadUser = Boolean(activeUserIdRef.current);
      const accountChanged = updateAccountBoundary(nextSession?.user.id ?? null);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setInitialized(true);
      if (!nextSession?.user) {
        if (hadUser && !explicitSignOutRef.current) setAuthMessage("auth.sessionExpired");
        explicitSignOutRef.current = false;
      }
      if (nextSession?.user && (accountChanged || event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "USER_UPDATED")) {
        scheduleUserSynchronization(nextSession.user, revision, accountChanged || event === "INITIAL_SESSION");
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadPets, updateAccountBoundary]);
}
