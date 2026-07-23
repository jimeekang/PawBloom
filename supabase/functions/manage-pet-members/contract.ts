export type PetMemberAction =
  | { action: "list"; petId: string }
  | { action: "invite"; petId: string; email: string }
  | { action: "remove"; petId: string; membershipId: string };

export class PetMemberRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PetMemberRequestError";
  }
}

export function parsePetMemberRequest(input: unknown): PetMemberAction {
  if (!isRecord(input)) throw new PetMemberRequestError("invalidRequest");
  const action = cleanString(input.action);
  const petId = cleanString(input.petId);
  if (!petId) throw new PetMemberRequestError("petRequired");

  if (action === "list") return { action, petId };
  if (action === "invite") {
    const email = normalizeInviteEmail(input.email);
    return { action, petId, email };
  }
  if (action === "remove") {
    const membershipId = cleanString(input.membershipId);
    if (!membershipId) throw new PetMemberRequestError("membershipRequired");
    return { action, petId, membershipId };
  }

  throw new PetMemberRequestError("invalidAction");
}

export function normalizeInviteEmail(value: unknown) {
  const email = cleanString(value)?.toLowerCase();
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new PetMemberRequestError("invalidEmail");
  }
  return email;
}

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
