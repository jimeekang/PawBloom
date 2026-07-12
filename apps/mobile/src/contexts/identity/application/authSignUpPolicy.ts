import type { IdentityMessageKey } from "./identityMessage";

export function authSignUpOutcome({ hasUser, hasSession }: { hasUser: boolean; hasSession: boolean }): {
  ensureProfile: boolean;
  messageKey: IdentityMessageKey | null;
} {
  if (hasUser && hasSession) return { ensureProfile: true, messageKey: "auth.signUpComplete" };
  if (hasUser) return { ensureProfile: false, messageKey: "auth.checkEmail" };
  return { ensureProfile: false, messageKey: null };
}
