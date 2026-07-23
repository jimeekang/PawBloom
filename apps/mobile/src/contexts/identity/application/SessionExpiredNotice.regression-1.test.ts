declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

// Regression: 0006 B1 — an explicit sign-out (or account deletion) must not
// surface the "session expired" notice. auth-js fires the SIGNED_OUT callback
// synchronously inside `await signOut()`, so the explicit-sign-out flag must
// be raised BEFORE the call, not in the post-await onSignedOut handler.

function read(path: string) {
  return readFileSync(`${process.cwd()}/apps/mobile/src/contexts/identity/application/${path}`, "utf8");
}

const authActions = read("useAuthActions.ts");
const contextState = read("authContextState.ts");

const startIndex = authActions.indexOf("onSignOutStarted()");
const signOutCallIndex = authActions.indexOf("supabase.auth.signOut()");
if (startIndex === -1 || signOutCallIndex === -1 || startIndex > signOutCallIndex) {
  throw new Error("useAuthActions must raise the explicit-sign-out flag before awaiting supabase.auth.signOut()");
}

if (!authActions.includes("onSignOutAborted()")) {
  throw new Error("a failed sign-out must lower the explicit-sign-out flag so a later real expiry still notifies");
}

const handleSignedOut = contextState.slice(contextState.indexOf("handleSignedOut"), contextState.indexOf("useAuthSessionSync({"));
if (handleSignedOut.includes("explicitSignOutRef.current = true")) {
  throw new Error(
    "handleSignedOut must not re-raise the flag after sign-out completes — the session sync already consumed and lowered it, and a stale true would swallow the next real session expiry",
  );
}
