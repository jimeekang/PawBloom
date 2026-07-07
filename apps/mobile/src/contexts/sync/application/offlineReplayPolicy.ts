import type { OfflineMutation } from "../domain/offlineMutation";

export type OfflineReplayStatus = "applied" | "retry" | "conflict" | "unsupported";

export type OfflineReplayResult = {
  status: OfflineReplayStatus;
  reason: string;
};

export type OfflineReplayHandler = (mutation: OfflineMutation) => Promise<OfflineReplayResult>;

const replayHandlers = new Map<string, OfflineReplayHandler>();

export function registerOfflineReplayHandler(aggregate: string, operation: OfflineMutation["operation"], handler: OfflineReplayHandler) {
  replayHandlers.set(replayHandlerKey(aggregate, operation), handler);
}

export async function replayOfflineMutation(mutation: OfflineMutation): Promise<OfflineReplayResult> {
  const handler = replayHandlers.get(replayHandlerKey(mutation.aggregate, mutation.operation));
  if (!handler) return { status: "unsupported", reason: `${mutation.aggregate}.${mutation.operation} replay is not supported yet` };
  return handler(mutation);
}

function replayHandlerKey(aggregate: string, operation: string) {
  return `${aggregate}.${operation}`;
}
