import { authSignUpOutcome } from "./authSignUpPolicy";

const emailConfirmation = authSignUpOutcome({ hasUser: true, hasSession: false });
if (emailConfirmation.ensureProfile || emailConfirmation.messageKey !== "auth.checkEmail") {
  throw new Error("email-confirmation signup must not write an RLS-protected profile before a session exists");
}

const immediateSession = authSignUpOutcome({ hasUser: true, hasSession: true });
if (!immediateSession.ensureProfile || immediateSession.messageKey !== "auth.signUpComplete") {
  throw new Error("session-backed signup must initialize the profile and show completion");
}
