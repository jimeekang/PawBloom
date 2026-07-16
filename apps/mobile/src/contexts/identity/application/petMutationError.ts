import type { IdentityMessageKey } from "./identityMessage";

export function petMutationErrorKey(error: unknown, fallback: IdentityMessageKey): IdentityMessageKey {
  const message = error instanceof Error ? error.message : "";
  return message.includes("pet_plan_limit_reached") ? "pet.planLimitReached" : fallback;
}
