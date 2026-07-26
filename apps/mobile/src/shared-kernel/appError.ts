// Coded errors let the application layer signal user-facing failures without
// importing i18n (architecture rule): the code is an i18n key as an opaque
// string, and the UI boundary maps it via i18n/errorNotice. The optional
// detail keeps the raw technical message for logging — never for display.
export class CodedError extends Error {
  readonly code: string;

  constructor(code: string, detail?: string) {
    super(detail ?? code);
    this.name = "CodedError";
    this.code = code;
  }
}

export function getErrorCode(error: unknown): string | null {
  return error instanceof CodedError ? error.code : null;
}
