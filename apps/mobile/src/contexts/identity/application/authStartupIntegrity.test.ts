declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as { readFileSync(path: string, encoding: "utf8"): string };
const source = readFileSync(`${process.cwd()}/apps/mobile/src/contexts/identity/application/authContextState.ts`, "utf8");

if (source.includes("onAuthStateChange(async")) {
  throw new Error("auth state callbacks must return synchronously before starting Supabase-backed synchronization");
}
if (!source.includes("setInitialized(true)") || !source.includes("scheduleUserSynchronization(currentSession.user, revisionAtStart, accountChanged)")) {
  throw new Error("session restoration must unblock the app before optional pet synchronization completes");
}
if (!source.includes("isCurrentRequest()") || !source.includes("activeUserIdRef.current === nextUser.id")) {
  throw new Error("late pet loads must not leak a previous account's state after an auth switch");
}
if (!source.includes("revisionAtStart !== authRevision") || !source.includes("revision === authRevision")) {
  throw new Error("auth events must invalidate stale startup and deferred synchronization work");
}
if ((source.match(/revisionAtStart !== authRevision/g) ?? []).length < 2 || !source.includes("isCurrentAccountWork(activeUserIdRef.current, userId, petLoadRevisionRef.current, requestRevision)")) {
  throw new Error("stale session failures and overlapping pet loads must not overwrite newer auth state");
}
if (!source.includes('event === "INITIAL_SESSION"') || !source.includes('event === "SIGNED_IN"') || !source.includes('event === "USER_UPDATED"') || source.includes('event === "TOKEN_REFRESHED"')) {
  throw new Error("same-account token refreshes must not unmount the app for a blocking pet reload");
}
if (!source.includes("const shouldBlock = blocking || !petListReadyRef.current") || !source.includes('accountChanged || event === "INITIAL_SESSION"')) {
  throw new Error("same-account background membership refreshes must preserve the shell on transient failures");
}
