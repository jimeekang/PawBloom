import { resolveAppGate } from "./appGate";

const authenticated = {
  authInitialized: true,
  languageInitialized: true,
  configured: true,
  userPresent: true,
  passwordRecoveryActive: false,
  activePetPresent: false,
} as const;

if (resolveAppGate({ ...authenticated, petLoadStatus: "loading" }) !== "loading") {
  throw new Error("an existing account must not see pet creation while its memberships are still loading");
}
if (resolveAppGate({ ...authenticated, petLoadStatus: "error" }) !== "pet-load-error") {
  throw new Error("a failed pet load must expose a retry state instead of a create-pet form");
}
if (resolveAppGate({ ...authenticated, petLoadStatus: "ready" }) !== "pet-onboarding") {
  throw new Error("pet onboarding is valid only after a successful empty membership query");
}
if (resolveAppGate({ ...authenticated, petLoadStatus: "ready", activePetPresent: true }) !== "shell") {
  throw new Error("a loaded active pet must enter the application shell");
}
if (resolveAppGate({ ...authenticated, passwordRecoveryActive: true, petLoadStatus: "ready", activePetPresent: true }) !== "password-recovery") {
  throw new Error("an active password recovery session must show the new-password screen before the shell");
}
if (resolveAppGate({ ...authenticated, userPresent: false, passwordRecoveryActive: true, petLoadStatus: "idle" }) !== "auth") {
  throw new Error("password recovery without a session must fall back to the auth screen");
}
