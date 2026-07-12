import { resolveAppGate } from "./appGate";

const authenticated = {
  authInitialized: true,
  languageInitialized: true,
  configured: true,
  userPresent: true,
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
