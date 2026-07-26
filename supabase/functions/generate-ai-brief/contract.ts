export const aiBriefRangeDays = [3, 7, 14] as const;
export const aiBriefLanguages = ["en", "ko"] as const;

export type AiBriefRangeDays = (typeof aiBriefRangeDays)[number];
export type AiBriefLanguage = (typeof aiBriefLanguages)[number];

export type AiBriefRequest = {
  petId: string;
  rangeDays: AiBriefRangeDays;
  language: AiBriefLanguage;
};

export class AiBriefRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiBriefRequestError";
  }
}

export function parseAiBriefRequest(input: unknown): AiBriefRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AiBriefRequestError("A valid pet and brief range are required");
  }

  const { petId, rangeDays, language } = input as Record<string, unknown>;
  if (typeof petId !== "string" || petId.trim().length === 0) {
    throw new AiBriefRequestError("A valid pet and brief range are required");
  }
  if (typeof rangeDays !== "number" || !aiBriefRangeDays.some((allowed) => allowed === rangeDays)) {
    throw new AiBriefRequestError("Brief range must be exactly 3, 7, or 14 days");
  }
  // Older clients omit language; they keep the original English briefs.
  if (language !== undefined && !aiBriefLanguages.some((allowed) => allowed === language)) {
    throw new AiBriefRequestError("Brief language must be en or ko");
  }

  return {
    petId: petId.trim(),
    rangeDays: rangeDays as AiBriefRangeDays,
    language: (language ?? "en") as AiBriefLanguage,
  };
}
