export type AppGate = "loading" | "preview" | "auth" | "pet-load-error" | "pet-onboarding" | "shell";

export function resolveAppGate({
  authInitialized,
  languageInitialized,
  configured,
  userPresent,
  petLoadStatus,
  activePetPresent,
}: {
  authInitialized: boolean;
  languageInitialized: boolean;
  configured: boolean;
  userPresent: boolean;
  petLoadStatus: "idle" | "loading" | "ready" | "error";
  activePetPresent: boolean;
}): AppGate {
  if (!authInitialized || !languageInitialized) return "loading";
  if (!configured) return "preview";
  if (!userPresent) return "auth";
  if (petLoadStatus === "error") return "pet-load-error";
  if (petLoadStatus !== "ready") return "loading";
  return activePetPresent ? "shell" : "pet-onboarding";
}
