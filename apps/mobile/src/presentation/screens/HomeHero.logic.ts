import type { Species } from "../../contexts/pet/domain/pet";

export type HomeHeroKind = "photo" | "mochi" | Species;

export function resolveHomeHeroKind({ petId, species, userId, photoUrl }: {
  petId: string;
  species: Species;
  userId: string | null;
  photoUrl?: string | null;
}): HomeHeroKind {
  if (photoUrl) return "photo";
  if (!userId && petId === "pet-demo-mochi") return "mochi";
  return species;
}
