import { supabase } from "../../../shared-kernel/supabase/client";
import { WebOutboxLockUnavailableError, type WebOutboxLockProvider, type WebStorageLike } from "./offlineOutboxAccountPurge.web";

export async function currentWebOutboxUserId() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  return error ? null : data.session?.user.id ?? null;
}

export function browserOutboxStorage(): WebStorageLike | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export async function browserOutboxLock<T>(name: string, task: () => T | Promise<T>) {
  const locks = (globalThis.navigator as typeof globalThis.navigator & { locks?: { request: WebOutboxLockProvider } } | undefined)?.locks;
  if (!locks?.request) throw new WebOutboxLockUnavailableError();
  try {
    return await locks.request(name, task);
  } catch (error) {
    if (typeof DOMException !== "undefined" && error instanceof DOMException
      && (error.name === "NotSupportedError" || error.name === "SecurityError")) throw new WebOutboxLockUnavailableError();
    throw error;
  }
}
