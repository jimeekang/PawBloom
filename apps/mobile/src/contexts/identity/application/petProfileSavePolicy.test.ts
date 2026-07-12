import { savePetProfileWithOptionalPhoto } from "./petProfileSavePolicy";

let profileWrites = 0;
const result = await savePetProfileWithOptionalPhoto({
  saveProfile: async () => {
    profileWrites += 1;
    return { id: "pet-1", name: "Milo" };
  },
  savePhoto: async (profile) => {
    if (profile.id !== "pet-1") throw new Error("photo save must receive the saved pet id");
    throw new Error("media insert failed");
  },
});

if (profileWrites !== 1 || result.profile.id !== "pet-1") {
  throw new Error("a photo failure must not retry or duplicate the already-created pet profile");
}
if (result.photoSaved || !(result.photoError instanceof Error)) {
  throw new Error("partial photo failure must be explicit while preserving the saved profile");
}
