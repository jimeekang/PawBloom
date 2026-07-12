import { authFormValidationKey, canSubmitAuth, createAuthModeTransition } from "./authFormState";

const transition = createAuthModeTransition("signUp");
if (transition.localError !== null || transition.passwordConfirm !== "") {
  throw new Error("switching auth modes must clear stale local errors and confirmation input");
}
if (authFormValidationKey({ mode: "signIn", email: "", password: "", passwordConfirm: "" }) !== "auth.requiredFields") {
  throw new Error("empty auth submission must show localized required-field validation");
}
if (authFormValidationKey({ mode: "signUp", email: "a@b.com", password: "one", passwordConfirm: "two" }) !== "auth.passwordMismatch") {
  throw new Error("signup mismatch must show localized validation");
}
if (canSubmitAuth(true, false) || canSubmitAuth(false, true) || !canSubmitAuth(false, false)) {
  throw new Error("auth submission must reject loading and same-tick duplicate presses");
}
