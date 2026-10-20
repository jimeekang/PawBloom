declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

// Regression: 0006 A2 — account deletion must confirm through the shared
// confirmDestructiveAction (web-safe, unlike raw Alert.alert), surface an
// in-progress state while the edge function runs, and announce success on
// the auth gate after sign-out.

function read(path: string) {
  return readFileSync(`${process.cwd()}/apps/mobile/src/${path}`, "utf8");
}

function occurrences(source: string, needle: string) {
  return source.split(needle).length - 1;
}

const settingsScreen = read("contexts/identity/ui/SettingsScreen.tsx");
const translations = read("i18n/translations.ts");
const accountDeletion = read("contexts/identity/application/useAccountDeletion.ts");
const deletionBoundary = read("contexts/identity/application/accountDeletionLocalBoundary.ts");
const deletionFlow = `${accountDeletion}\n${deletionBoundary}`;
const identityMessage = read("contexts/identity/application/identityMessage.ts");

if (settingsScreen.includes("Alert.alert")) {
  throw new Error("SettingsScreen must not use raw Alert.alert (web no-op); use confirmDestructiveAction");
}

if (!settingsScreen.includes("confirmDestructiveAction")) {
  throw new Error("SettingsScreen must confirm account deletion via confirmDestructiveAction");
}

const dangerButton = read("design-system/feedback.tsx");
if (!settingsScreen.includes("settings.deleteAccountInProgress") || !settingsScreen.includes("busy={deleting}") || !dangerButton.includes("ActivityIndicator")) {
  throw new Error("SettingsScreen must show a deleting progress state (DangerButton busy spinner + settings.deleteAccountInProgress)");
}

for (const key of ['"settings.deleteAccountInProgress"', '"auth.accountDeleted"']) {
  if (occurrences(translations, key) < 2) {
    throw new Error(`${key} must be defined in both en and ko translations`);
  }
}

if (!identityMessage.includes('"auth.accountDeleted"')) {
  throw new Error("IdentityMessageKey must include auth.accountDeleted");
}

if (!accountDeletion.includes("announceAccountDeleted")) {
  throw new Error("useAccountDeletion must announce deletion success on the auth gate after sign-out");
}

if (!accountDeletion.includes("purgeOfflineMutationsForAccount(userId)")) {
  throw new Error("authoritative account deletion must purge the exact account's local offline mutations");
}

if (!deletionFlow.includes("clearDeletedAccountLocalSession(input.userId)")) {
  throw new Error("account deletion must clear the local auth session after the server removes the user");
}

const forceBoundaryIndex = deletionBoundary.indexOf("forceLocalAuthBoundary(input.userId)");
const localSignOutIndex = deletionBoundary.indexOf("clearDeletedAccountLocalSession(input.userId)");
if (forceBoundaryIndex < 0 || forceBoundaryIndex > localSignOutIndex) {
  throw new Error("an authoritative deletion response must force the React/cache boundary before fallible SDK sign-out");
}
if (!deletionBoundary.includes("deletedAccountWasCurrent\n    ? startBestEffort")) {
  throw new Error("account deletion must not sign out a different account selected while the bound request was in flight");
}
if (!deletionBoundary.includes("localCleanupPending: outboxCleanup?.status === \"rejected\"")) {
  throw new Error("account deletion must expose an unverified local outbox purge instead of silently treating it as complete");
}

const authState = read("contexts/identity/application/authContextState.ts");
for (const invariant of ["activeUserIdRef.current !== expectedUserId", "updateAccountBoundary(null)", "setSession(null)", "setUser(null)"]) {
  if (!authState.includes(invariant)) throw new Error(`forced local auth boundary missing: ${invariant}`);
}
if (!authState.includes("const locallyDeletedUserIds = new Set<string>()")) {
  throw new Error("the deleted-account auth deny set must survive an AuthProvider remount in this process");
}

const authActions = read("contexts/identity/application/useAuthActions.ts");
if (!authActions.includes('client.auth.signOut({ scope: "local" })')) {
  throw new Error("deleted-account SDK cleanup must be local-only after authoritative server deletion");
}
