type ErrorLike = { code?: unknown; message?: unknown; name?: unknown };

const retryableMessage = /network request failed|failed to fetch|fetch failed|load failed|network is offline|internet connection|connection (?:reset|refused|closed)|timed? out|timeout/i;

export function isRetriableOfflineError(error: unknown) {
  const value = toErrorLike(error);
  const code = typeof value.code === "string" ? value.code : "";
  const message = typeof value.message === "string" ? value.message : String(error);

  if (code && /^(?:23|22|42|PGRST|42501)/i.test(code)) return false;
  return retryableMessage.test(message) || value.name === "TypeError" && /fetch|network/i.test(message);
}

export function offlineErrorMessage(error: unknown) {
  const value = toErrorLike(error);
  return typeof value.message === "string" && value.message.length > 0 ? value.message : String(error);
}

function toErrorLike(error: unknown): ErrorLike {
  return error && typeof error === "object" ? error as ErrorLike : {};
}
