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
  from: () => ({
    insert: async () => ({ error: { message: "media row failed" } }),
  }),
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
