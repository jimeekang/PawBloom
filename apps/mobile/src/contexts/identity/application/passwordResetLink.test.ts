import { parseRecoveryLink } from "./passwordResetLink";

const fragmentLink =
  "pawbloom://reset-password#access_token=at-1&refresh_token=rt-1&type=recovery&expires_in=3600";
const fragmentResult = parseRecoveryLink(fragmentLink);
if (fragmentResult.kind !== "recovery" || fragmentResult.accessToken !== "at-1" || fragmentResult.refreshToken !== "rt-1") {
  throw new Error("custom-scheme recovery links must parse tokens from the URL fragment");
}

const expoGoLink =
  "exp://192.168.0.12:8081/--/reset-password?access_token=at-2&refresh_token=rt-2&type=recovery";
const expoGoResult = parseRecoveryLink(expoGoLink);
if (expoGoResult.kind !== "recovery" || expoGoResult.accessToken !== "at-2" || expoGoResult.refreshToken !== "rt-2") {
  throw new Error("Expo Go recovery links must parse tokens from query params");
}

const expiredLink =
  "pawbloom://reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid";
if (parseRecoveryLink(expiredLink).kind !== "invalid") {
  throw new Error("expired/used recovery links must be classified invalid so the user sees guidance");
}

if (parseRecoveryLink("pawbloom://reset-password#access_token=at-only&type=recovery").kind !== "invalid") {
  throw new Error("a recovery link without a refresh token cannot start a session and must be invalid");
}

if (parseRecoveryLink("pawbloom://reset-password").kind !== "unrelated") {
  throw new Error("opening the bare reset path without params must not surface an error banner");
}

if (parseRecoveryLink("pawbloom://diary?entry=1").kind !== "unrelated") {
  throw new Error("non-reset links must be ignored by the recovery handler");
}

if (parseRecoveryLink(null).kind !== "unrelated") {
  throw new Error("a missing URL must be ignored");
}
