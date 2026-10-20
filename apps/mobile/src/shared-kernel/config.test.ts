import {
  allowsUnconfiguredPreview,
  hasValidSupabaseConfiguration,
  resolveAppRuntimeProfile,
} from "./config";

const validKey = "sb_publishable_abcdefghijklmnopqrstuvwxyz";

if (!hasValidSupabaseConfiguration("https://project.supabase.co", validKey)) {
  throw new Error("a valid HTTPS Supabase URL and publishable key must configure the account service");
}
if (hasValidSupabaseConfiguration("http://project.supabase.co", validKey)) {
  throw new Error("release configuration must reject a non-HTTPS Supabase URL");
}
if (hasValidSupabaseConfiguration("not a URL", validKey)) {
  throw new Error("release configuration must reject a malformed Supabase URL");
}
if (hasValidSupabaseConfiguration("https://project.supabase.co", "short-key")) {
  throw new Error("release configuration must reject a malformed publishable key");
}
if (hasValidSupabaseConfiguration("https://project.supabase.co", "your-supabase-publishable-key")) {
  throw new Error("release configuration must reject a placeholder publishable key");
}
if (resolveAppRuntimeProfile(undefined, true) !== "development") {
  throw new Error("a development bundle may default to the development profile");
}
if (resolveAppRuntimeProfile(undefined, false) !== "invalid") {
  throw new Error("a non-development bundle must fail closed when its explicit app profile is missing");
}
if (resolveAppRuntimeProfile("unexpected", false) !== "invalid") {
  throw new Error("a non-development bundle must fail closed when its explicit app profile is malformed");
}
if (!allowsUnconfiguredPreview(resolveAppRuntimeProfile("preview", false))) {
  throw new Error("the explicit preview profile must keep the unconfigured UI preview available");
}
if (allowsUnconfiguredPreview(resolveAppRuntimeProfile("production", false))) {
  throw new Error("the production profile must never fall back to an unconfigured UI preview");
}
