import { buildPhotoUploadBody, type UpdatePetInput } from "./authContextQueries";

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
