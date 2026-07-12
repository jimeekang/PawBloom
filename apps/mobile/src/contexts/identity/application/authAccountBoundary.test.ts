import { QueryClient } from "@tanstack/react-query";
import { clearAccountScopedQueryCache, isCurrentAccountWork } from "./authAccountBoundary";

const queryClient = new QueryClient();
const ownerId = "owner-a";
const nextUserId = "caregiver-b";
const reportKey = ["vet_report", "pet-shared", ownerId];
queryClient.setQueryData(reportKey, { shareUrl: "private-owner-link" });

if (!clearAccountScopedQueryCache(queryClient, ownerId, nextUserId) || queryClient.getQueryData(reportKey) !== undefined) {
  throw new Error("an account change must synchronously remove cached bearer links and pet records");
}

queryClient.setQueryData(reportKey, { safe: true });
if (clearAccountScopedQueryCache(queryClient, ownerId, ownerId) || queryClient.getQueryData(reportKey) === undefined) {
  throw new Error("a token refresh for the same account must not discard its cache");
}

if (isCurrentAccountWork(nextUserId, ownerId, 2, 1) || isCurrentAccountWork(ownerId, ownerId, 2, 1)) {
  throw new Error("late work from a previous account or epoch must never update current state");
}
if (!isCurrentAccountWork(ownerId, ownerId, 2, 2)) throw new Error("current-account work must remain applicable");
