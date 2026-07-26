import { getErrorCode } from "../shared-kernel/appError";
import { hasTranslation, t, type TranslationKey } from "./translations";

// UI-boundary mapping for CodedError: renders the coded key in the active
// language, or the operation-specific fallback for uncoded/unknown errors.
// Raw error messages never reach the user through this path.
export function errorNoticeText(error: unknown, fallbackKey: TranslationKey): string {
  const code = getErrorCode(error);
  if (code && hasTranslation(code)) return t(code);
  return t(fallbackKey);
}
