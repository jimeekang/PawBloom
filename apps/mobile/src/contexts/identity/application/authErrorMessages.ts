import type { IdentityMessageKey } from "./identityMessage";

type AuthErrorShape = {
  code?: unknown;
  name?: unknown;
  status?: unknown;
};

export function authErrorTranslationKey(error: unknown): IdentityMessageKey {
  const details = isAuthErrorShape(error) ? error : null;
  const code = typeof details?.code === "string" ? details.code : undefined;

  switch (code) {
    case "email_address_invalid":
    case "validation_failed":
      return "auth.emailInvalid";
    case "invalid_credentials":
      return "auth.error.invalidCredentials";
    case "email_not_confirmed":
      return "auth.error.emailNotConfirmed";
    case "email_exists":
    case "user_already_exists":
      return "auth.error.emailExists";
    case "weak_password":
      return "auth.error.weakPassword";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "auth.error.rateLimit";
    case "email_provider_disabled":
    case "signup_disabled":
      return "auth.error.signUpDisabled";
    case "request_timeout":
    case "unexpected_failure":
      return "auth.error.unavailable";
    default:
      break;
  }

  if (details?.name === "AuthRetryableFetchError" || (typeof details?.status === "number" && details.status >= 500)) {
    return "auth.error.unavailable";
  }

  return "auth.error.generic";
}

function isAuthErrorShape(value: unknown): value is AuthErrorShape {
  return typeof value === "object" && value !== null;
}
