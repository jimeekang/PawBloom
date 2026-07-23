// Pure parser for Supabase password-recovery redirect links. Kept free of
// expo/react imports so link classification can be unit tested in isolation
// (see passwordResetLink.test.ts). The hook in passwordRecoveryLink.ts owns
// the expo-linking subscription and session side effects.
export const PASSWORD_RESET_PATH = "reset-password";

export type RecoveryLink =
  | { kind: "recovery"; accessToken: string; refreshToken: string }
  | { kind: "invalid" }
  | { kind: "unrelated" };

export function parseRecoveryLink(url: string | null | undefined): RecoveryLink {
  if (!url || !url.includes(PASSWORD_RESET_PATH)) return { kind: "unrelated" };

  const params = collectParams(url);
  if (params.size === 0) return { kind: "unrelated" };

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (params.get("type") === "recovery" && accessToken && refreshToken) {
    return { kind: "recovery", accessToken, refreshToken };
  }

  // Reached our reset path with params that are not a usable recovery session
  // (expired/used link error redirects land here with error_code etc.).
  return { kind: "invalid" };
}

function collectParams(url: string) {
  const params = new Map<string, string>();
  for (const section of url.split(/[#?]/).slice(1)) {
    for (const pair of section.split("&")) {
      const [key, value] = pair.split("=");
      if (key && value !== undefined && !params.has(key)) {
        params.set(key, decodeURIComponent(value));
      }
    }
  }
  return params;
}
