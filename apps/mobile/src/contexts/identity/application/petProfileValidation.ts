import type { IdentityMessageKey } from "./identityMessage";

export function petProfileValidationKey({
  configured,
  userPresent,
  name,
}: {
  configured: boolean;
  userPresent: boolean;
  name: string;
}): IdentityMessageKey | null {
  if (!configured || !userPresent) return "pet.loginRequired";
  if (!name.trim()) return "pet.nameRequired";
  return null;
}

export function petDeleteValidationKey({
  configured,
  userPresent,
  petId,
}: {
  configured: boolean;
  userPresent: boolean;
  petId: string;
}): IdentityMessageKey | null {
  if (!configured || !userPresent) return "pet.loginRequired";
  if (!petId) return "pet.profileRequired";
  return null;
}
