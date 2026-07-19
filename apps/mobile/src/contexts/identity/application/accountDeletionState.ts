// Pure state machine for the in-app account deletion flow. Kept free of React,
// Supabase, and expo imports so the transitions can be unit tested in isolation
// (see accountDeletionState.test.ts). The hook in useAccountDeletion.ts drives
// the side effects; this module only decides which status is reachable next.
export type AccountDeletionStatus = "idle" | "confirming" | "deleting" | "error";

export type AccountDeletionState = { status: AccountDeletionStatus };

export type AccountDeletionAction =
  | { type: "request" } // user tapped "Delete account" (or retried after an error)
  | { type: "cancel" } // user dismissed the confirmation dialog
  | { type: "start" } // user confirmed; deletion request is now in flight
  | { type: "succeed" } // deletion + sign-out completed
  | { type: "fail" }; // deletion request failed

export const initialAccountDeletionState: AccountDeletionState = { status: "idle" };

export function accountDeletionReducer(state: AccountDeletionState, action: AccountDeletionAction): AccountDeletionState {
  switch (action.type) {
    case "request":
      return state.status === "idle" || state.status === "error" ? { status: "confirming" } : state;
    case "cancel":
      return state.status === "confirming" ? { status: "idle" } : state;
    case "start":
      return state.status === "confirming" ? { status: "deleting" } : state;
    case "succeed":
      return state.status === "deleting" ? { status: "idle" } : state;
    case "fail":
      return state.status === "deleting" ? { status: "error" } : state;
    default:
      return state;
  }
}
