import { accountDeletionReducer, initialAccountDeletionState, type AccountDeletionState } from "./accountDeletionState";

function reduce(status: AccountDeletionState["status"], action: Parameters<typeof accountDeletionReducer>[1]) {
  return accountDeletionReducer({ status }, action).status;
}

if (initialAccountDeletionState.status !== "idle") throw new Error("account deletion must start idle");

// Happy path: idle → confirming → deleting → idle
if (reduce("idle", { type: "request" }) !== "confirming") throw new Error("request from idle must open confirmation");
if (reduce("confirming", { type: "start" }) !== "deleting") throw new Error("start from confirming must begin deleting");
if (reduce("deleting", { type: "succeed" }) !== "idle") throw new Error("succeed from deleting must return to idle");

// Cancel path: confirming → idle
if (reduce("confirming", { type: "cancel" }) !== "idle") throw new Error("cancel from confirming must return to idle");

// Failure + retry: deleting → error, then error → confirming clears it on retry.
if (reduce("deleting", { type: "fail" }) !== "error") throw new Error("fail from deleting must surface error");
if (reduce("error", { type: "request" }) !== "confirming") throw new Error("request from error must allow retry");

// The delete side effect dispatches `start` before any early return, so even the
// no-client / no-session guard reaches the error state from confirming.
const afterStart = accountDeletionReducer({ status: "confirming" }, { type: "start" });
if (accountDeletionReducer(afterStart, { type: "fail" }).status !== "error") throw new Error("start then fail from confirming must reach error");

// Guards: invalid transitions must be no-ops so the machine never skips confirmation.
if (reduce("idle", { type: "start" }) !== "idle") throw new Error("start without confirmation must be ignored");
if (reduce("idle", { type: "cancel" }) !== "idle") throw new Error("cancel while idle must be ignored");
if (reduce("deleting", { type: "cancel" }) !== "deleting") throw new Error("cancel must not interrupt an in-flight deletion");
if (reduce("deleting", { type: "request" }) !== "deleting") throw new Error("request must not reopen confirmation mid-deletion");
if (reduce("confirming", { type: "succeed" }) !== "confirming") throw new Error("succeed is only valid from deleting");

console.log("accountDeletionState transitions verified");
