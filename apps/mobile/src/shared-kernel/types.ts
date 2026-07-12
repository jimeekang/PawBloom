export type UUID = string;

export type Language = "en" | "ko";

export type PetMemberRole = "owner" | "caregiver" | "pet_sitter";

export type AppRole = PetMemberRole | "vet_report_viewer";

export type Result<T, E extends Error = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
