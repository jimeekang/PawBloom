declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

// Regression: 0006 A3 — the password reset loop must stay reachable:
// entry point on the sign-in screen, reset email request, and a recovery
// deep-link gate that lets the user set a new password.

function read(path: string) {
  return readFileSync(`${process.cwd()}/apps/mobile/${path}`, "utf8");
}

function occurrences(source: string, needle: string) {
  return source.split(needle).length - 1;
}

const authScreen = read("src/contexts/identity/ui/AuthScreen.tsx");
const recoveryScreen = read("src/contexts/identity/ui/PasswordRecoveryScreen.tsx");
const authActions = read("src/contexts/identity/application/useAuthActions.ts");
const appEntry = read("App.tsx");
const appGate = read("src/presentation/appGate.ts");
const translations = read("src/i18n/translations.ts");

if (!authScreen.includes("auth.forgotPassword") || !authScreen.includes("requestPasswordReset")) {
  throw new Error("AuthScreen must expose a forgot-password entry that requests a reset email");
}

if (!authActions.includes("resetPasswordForEmail") || !authActions.includes("updateUser")) {
  throw new Error("auth actions must send the reset email and update the password from a recovery session");
}

if (!appEntry.includes("PasswordRecoveryScreen")) {
  throw new Error("App gate must mount PasswordRecoveryScreen for recovery deep links");
}

if (!recoveryScreen.includes("auth.resetDone") || !recoveryScreen.includes("auth.resetContinue")) {
  throw new Error("PasswordRecoveryScreen must confirm success on-screen before leaving the recovery gate (review finding)");
}

if (!appGate.includes('"password-recovery"')) {
  throw new Error("appGate must route an active recovery session to the new-password screen");
}

for (const key of ['"auth.forgotPassword"', '"auth.resetEmailSent"', '"auth.newPassword"', '"auth.resetDone"', '"auth.resetLinkInvalid"']) {
  if (occurrences(translations, key) < 2) {
    throw new Error(`${key} must be defined in both en and ko translations`);
  }
}
