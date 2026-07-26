import { useEffect, useRef } from "react";
import * as Linking from "expo-linking";
import { supabase } from "../infrastructure/supabaseClient";
import { parseRecoveryLink, PASSWORD_RESET_PATH } from "./passwordResetLink";
import type { IdentityMessageKey } from "./identityMessage";

// The redirect target sent with resetPasswordForEmail. In Expo Go this is an
// exp:// URL, in builds pawbloom://reset-password — both must be listed in the
// Supabase dashboard's auth redirect allowlist.
export function getPasswordResetRedirectUrl() {
  return Linking.createURL(PASSWORD_RESET_PATH);
}

// Watches incoming app links for a Supabase recovery redirect. A valid link
// establishes the recovery session and flips the auth gate into the
// new-password screen; invalid/expired links surface auth.resetLinkInvalid.
export function usePasswordRecoveryLink({
  activate,
  setError,
}: {
  activate: () => void;
  setError: (key: IdentityMessageKey) => void;
}) {
  const url = Linking.useURL();
  const handledUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!url || handledUrlRef.current === url) return;
    const parsed = parseRecoveryLink(url);
    if (parsed.kind === "unrelated") return;

    handledUrlRef.current = url;
    if (parsed.kind === "invalid" || !supabase) {
      setError("auth.resetLinkInvalid");
      return;
    }

    void supabase.auth
      .setSession({ access_token: parsed.accessToken, refresh_token: parsed.refreshToken })
      .then(({ error }) => {
        if (error) {
          setError("auth.resetLinkInvalid");
          return;
        }
        activate();
      })
      .catch(() => setError("auth.resetLinkInvalid"));
  }, [activate, setError, url]);
}
