import { resolveHomeHeroKind } from "./HomeHero.logic";

if (resolveHomeHeroKind({ petId: "pet-demo-mochi", species: "dog", userId: null }) !== "mochi") {
  throw new Error("the bundled Mochi photo must remain limited to the Mochi preview profile");
}

if (resolveHomeHeroKind({ petId: "pet-demo-luna", species: "cat", userId: null }) !== "cat") {
  throw new Error("the Luna preview profile must never fall back to Mochi's dog photo");
}

if (resolveHomeHeroKind({ petId: "pet-live", species: "dog", userId: "user-1" }) !== "dog") {
  throw new Error("a live pet without a photo must use a species placeholder, not another pet's photo");
}

if (resolveHomeHeroKind({ petId: "pet-live", species: "cat", userId: "user-1", photoUrl: "signed://photo" }) !== "photo") {
  throw new Error("an uploaded profile photo must take precedence over every fallback");
}
