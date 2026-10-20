export type AppRuntimeProfile = "development" | "preview" | "production" | "invalid";

export const env = {
  appProfile: process.env.EXPO_PUBLIC_APP_PROFILE ?? "",
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
};

export function resolveAppRuntimeProfile(rawProfile: string | undefined, developmentBuild: boolean): AppRuntimeProfile {
  const profile = rawProfile?.trim().toLowerCase();
  if (profile === "development" || profile === "preview" || profile === "production") return profile;
  return developmentBuild ? "development" : "invalid";
}

export function allowsUnconfiguredPreview(profile: AppRuntimeProfile) {
  return profile === "development" || profile === "preview";
}

export function hasValidSupabaseConfiguration(url: string, publishableKey: string) {
  const normalizedUrl = url.trim();
  const normalizedKey = publishableKey.trim();
  const publishableKeyPattern = /^sb_publishable_[A-Za-z0-9_-]{20,}$/;
  const legacyAnonKeyPattern = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
  if (!publishableKeyPattern.test(normalizedKey) && !legacyAnonKeyPattern.test(normalizedKey)) return false;

  try {
    const parsedUrl = new URL(normalizedUrl);
    return parsedUrl.protocol === "https:" && Boolean(parsedUrl.hostname);
  } catch {
    return false;
  }
}

const developmentBuild = typeof __DEV__ === "boolean" ? __DEV__ : process.env.NODE_ENV !== "production";

export const appRuntimeProfile = resolveAppRuntimeProfile(env.appProfile, developmentBuild);
export const isSupabaseConfigured = hasValidSupabaseConfiguration(env.supabaseUrl, env.supabasePublishableKey);

export const PRIVACY_POLICY_URL = "https://github.com/jimeekang/PawBloom/blob/main/docs/product/PRIVACY_POLICY.md";
export const SUPPORT_URL = "mailto:kjm12081@gmail.com";
