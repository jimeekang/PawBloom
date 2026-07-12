import { authErrorTranslationKey } from "./authErrorMessages";

if (authErrorTranslationKey({ code: "invalid_credentials", status: 400 }) !== "auth.error.invalidCredentials") {
  throw new Error("invalid credentials must use a safe localized message");
}
if (authErrorTranslationKey({ code: "weak_password", message: "raw backend password rule" }) !== "auth.error.weakPassword") {
  throw new Error("weak password responses must be mapped by code, not backend text");
}
if (authErrorTranslationKey({ code: "over_request_rate_limit", status: 429 }) !== "auth.error.rateLimit") {
  throw new Error("rate limits must tell the user to wait");
}
if (authErrorTranslationKey({ name: "AuthRetryableFetchError" }) !== "auth.error.unavailable") {
  throw new Error("retryable network failures must not expose raw client errors");
}
if (authErrorTranslationKey(new Error("sensitive backend details")) !== "auth.error.generic") {
  throw new Error("unknown errors must fall back to a user-safe generic message");
}
