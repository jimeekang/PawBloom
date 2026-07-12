export const aiBriefRangeDays = [3, 7, 14] as const;

export type AiBriefRangeDays = (typeof aiBriefRangeDays)[number];

export type AiBriefRequest = {
  petId: string;
  rangeDays: AiBriefRangeDays;
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

  const { petId, rangeDays } = input as Record<string, unknown>;
  if (typeof petId !== "string" || petId.trim().length === 0) {
    throw new AiBriefRequestError("A valid pet and brief range are required");
  }
  if (typeof rangeDays !== "number" || !aiBriefRangeDays.some((allowed) => allowed === rangeDays)) {
    throw new AiBriefRequestError("Brief range must be exactly 3, 7, or 14 days");
  }

  return { petId: petId.trim(), rangeDays: rangeDays as AiBriefRangeDays };
}
