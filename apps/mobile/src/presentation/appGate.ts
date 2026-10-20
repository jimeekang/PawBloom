export type AppGate = "loading" | "configuration-error" | "preview" | "auth" | "password-recovery" | "pet-load-error" | "pet-onboarding" | "shell";

export function resolveAppGate({
  authInitialized,
  languageInitialized,
  configured,
  allowUnconfiguredPreview,
  userPresent,
  passwordRecoveryActive,
  petLoadStatus,
  activePetPresent,
}: {
  authInitialized: boolean;
  languageInitialized: boolean;
  configured: boolean;
  allowUnconfiguredPreview: boolean;
  userPresent: boolean;
  passwordRecoveryActive: boolean;
  petLoadStatus: "idle" | "loading" | "ready" | "error";
  activePetPresent: boolean;
}): AppGate {
  if (!authInitialized || !languageInitialized) return "loading";
  if (!configured) return allowUnconfiguredPreview ? "preview" : "configuration-error";
  if (!userPresent) return "auth";
  if (passwordRecoveryActive) return "password-recovery";
  if (petLoadStatus === "error") return "pet-load-error";
  if (petLoadStatus !== "ready") return "loading";
  return activePetPresent ? "shell" : "pet-onboarding";
}
