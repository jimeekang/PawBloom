import { buildPhotoUploadBody, uploadPetProfilePhoto, type UpdatePetInput } from "./authContextQueries";

const updateWithProfilePhoto: UpdatePetInput = {
  id: "pet-photo-test",
  name: "Photo",
  species: "dog",
  breed: "",
  birthdate: "",
  weightKg: 0,
  profilePhoto: {
    uri: "file:///photo.jpg",
    fileName: "photo.jpg",
    mimeType: "image/jpeg",
  },
};

const iosLibraryUploadBody = buildPhotoUploadBody({
  uri: "ph://simulator-photo",
  fileName: "IMG_0001.JPG",
  mimeType: "image/jpeg",
  base64: "/9j/4AAQSkZJRgABAQAAAQABAAD/2w==",
});

const iosLibraryUploadBodyIsBinary: ArrayBuffer = iosLibraryUploadBody;

void updateWithProfilePhoto;
void iosLibraryUploadBodyIsBinary;

let removedPath = "";
const failingAssetClient = {
  storage: {
    from: () => ({
      upload: async () => ({ error: null }),
      remove: async ([path]: string[]) => {
        removedPath = path ?? "";
        return { error: null };
      },
    }),
  },
  rpc: async () => ({ data: null, error: { message: "media row failed" } }),
};

try {
  await uploadPetProfilePhoto(failingAssetClient as never, "user-1", "pet-1", {
    uri: "file:///photo.jpg",
    fileName: "photo.jpg",
    mimeType: "image/jpeg",
    base64: "/9j/4AAQSkZJRgABAQAAAQABAAD/2w==",
  });
  throw new Error("media row failure must reject the photo save");
} catch (error) {
  if (!(error instanceof Error) || error.message === "media row failure must reject the photo save") throw error;
}

if (!removedPath.startsWith("pet-1/profile/")) {
  throw new Error("failed media metadata inserts must remove the uploaded storage object");
}

let ambiguousRpcAttempts = 0;
const ambiguousRemovals: string[] = [];
const ambiguousAssetClient = {
  storage: {
    from: () => ({
      upload: async () => ({ error: null }),
      remove: async (paths: string[]) => { ambiguousRemovals.push(...paths); return { error: null }; },
    }),
  },
  rpc: async (name: string) => {
    if (name === "replace_pet_profile_photo_v1") {
      ambiguousRpcAttempts += 1;
      if (ambiguousRpcAttempts === 1) throw new TypeError("Network request failed");
      return { data: { record: { storage_path: "pet-1/profile/retried.jpg" }, cleanup_paths: [] }, error: null };
    }
    return { data: 0, error: null };
  },
};

await uploadPetProfilePhoto(ambiguousAssetClient as never, "user-1", "pet-1", {
  uri: "file:///photo.jpg",
  fileName: "photo.jpg",
  mimeType: "image/jpeg",
  base64: "/9j/4AAQSkZJRgABAQAAAQABAAD/2w==",
});
if (ambiguousRpcAttempts !== 2 || ambiguousRemovals.length !== 0) {
  throw new Error("an ambiguous profile-photo response must retry idempotently without deleting the possibly committed object");
}

const removedBatches: string[][] = [];
const completedBatches: string[][] = [];
const replacingAssetClient = {
  storage: {
    from: () => ({
      upload: async () => ({ error: null }),
      remove: async (paths: string[]) => {
        removedBatches.push(paths);
        return { error: null };
      },
    }),
  },
  rpc: async (name: string, args?: { p_storage_paths?: string[] }) => {
    if (name === "replace_pet_profile_photo_v1") {
      return {
        data: { record: { storage_path: "pet-1/profile/new.jpg" }, cleanup_paths: ["pet-1/profile/old.jpg"] },
        error: null,
      };
    }
    if (name === "complete_media_cleanup_v1") {
      completedBatches.push(args?.p_storage_paths ?? []);
      return { data: 1, error: null };
    }
    throw new Error(`unexpected rpc: ${name}`);
  },
};

await uploadPetProfilePhoto(replacingAssetClient as never, "user-1", "pet-1", {
  uri: "file:///photo.jpg",
  fileName: "photo.jpg",
  mimeType: "image/jpeg",
  base64: "/9j/4AAQSkZJRgABAQAAAQABAAD/2w==",
});

if (removedBatches.flat().join(",") !== "pet-1/profile/old.jpg") {
  throw new Error("profile replacement must remove only the superseded storage object after the DB commit");
}
if (completedBatches.flat().join(",") !== "pet-1/profile/old.jpg") {
  throw new Error("profile replacement must acknowledge completed queued cleanup");
}
