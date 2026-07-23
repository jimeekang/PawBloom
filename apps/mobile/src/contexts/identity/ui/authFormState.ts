import type { TranslationKey } from "../../../i18n/translations";

export type AuthMode = "signIn" | "signUp";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidAuthEmail(email: string) {
  return EMAIL_PATTERN.test(email.trim());
}

export function authFormValidationKey({
  mode,
  email,
  password,
  passwordConfirm,
}: {
  mode: AuthMode;
  email: string;
  password: string;
  passwordConfirm: string;
}): TranslationKey | null {
  if (!email.trim() || !password || (mode === "signUp" && !passwordConfirm)) return "auth.requiredFields";
  if (!isValidAuthEmail(email)) return "auth.emailInvalid";
  if (mode === "signUp" && password !== passwordConfirm) return "auth.passwordMismatch";
  return null;
}

export function createAuthModeTransition(mode: AuthMode) {
  return { mode, localError: null, passwordConfirm: "" } as const;
}

export function canSubmitAuth(loading: boolean, submissionInFlight: boolean) {
  return !loading && !submissionInFlight;
}
