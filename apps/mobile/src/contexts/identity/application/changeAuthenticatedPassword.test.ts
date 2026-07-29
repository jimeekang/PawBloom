import { changeAuthenticatedPassword } from "./changeAuthenticatedPassword";

const calls: string[] = [];
const success = await changeAuthenticatedPassword({
  reauthenticate: async () => {
    calls.push("reauthenticate");
    return { error: null };
  },
  updatePassword: async () => {
    calls.push("updatePassword");
    return { error: null };
  },
});

if (success !== null || calls.join(",") !== "reauthenticate,updatePassword") {
  throw new Error("password changes must reauthenticate before updating the password");
}

const invalidCredentials = { code: "invalid_credentials" };
let updatedAfterFailure = false;
const failure = await changeAuthenticatedPassword({
  reauthenticate: async () => ({ error: invalidCredentials }),
  updatePassword: async () => {
    updatedAfterFailure = true;
    return { error: null };
  },
});

if (failure !== invalidCredentials || updatedAfterFailure) {
  throw new Error("a failed reauthentication must stop before the password update");
}
