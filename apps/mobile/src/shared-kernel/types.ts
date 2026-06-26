export type UUID = string;

export type Language = "en" | "ko";

export type AppRole = "owner" | "caregiver" | "pet_sitter" | "vet_report_viewer";

export type Result<T, E extends Error = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

