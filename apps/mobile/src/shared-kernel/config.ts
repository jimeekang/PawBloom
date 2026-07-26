export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
};

export const isSupabaseConfigured =
  env.supabaseUrl.startsWith("https://") && env.supabasePublishableKey.length > 20;

export const PRIVACY_POLICY_URL = "https://github.com/jimeekang/PawBloom/blob/main/docs/product/PRIVACY_POLICY.md";
export const SUPPORT_URL = "mailto:kjm12081@gmail.com";

