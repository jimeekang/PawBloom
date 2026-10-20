import type { QueryClient } from "@tanstack/react-query";

export function clearAccountScopedQueryCache(queryClient: QueryClient, previousUserId: string | null, nextUserId: string | null) {
  if (previousUserId === nextUserId) return false;
  queryClient.clear();
  return true;
}

export function isCurrentAccountWork(
  activeUserId: string | null,
  requestUserId: string | null,
  currentEpoch: number,
  requestEpoch: number,
) {
  return Boolean(requestUserId && activeUserId === requestUserId && currentEpoch === requestEpoch);
}

export function excludeLocallyDeletedSession<T extends { user: { id: string } }>(
  session: T | null,
  locallyDeletedUserIds: ReadonlySet<string>,
) {
  return session && !locallyDeletedUserIds.has(session.user.id) ? session : null;
}
