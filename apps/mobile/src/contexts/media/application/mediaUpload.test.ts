import { buildDiaryPhotoStoragePath, resolveSupportedPhotoContentType } from "./mediaUpload";

if (resolveSupportedPhotoContentType({ uri: "file:///photo.png", mimeType: "image/png" }) !== "image/png") {
  throw new Error("supported photo content types must be preserved");
}
if (resolveSupportedPhotoContentType({ uri: "file:///photo.heic", mimeType: "image/heic", base64: "jpeg-data" }) !== "image/jpeg") {
  throw new Error("picker-provided JPEG base64 must normalize HEIC selections before upload");
}
try {
  resolveSupportedPhotoContentType({ uri: "file:///photo.heic", mimeType: "image/heic" });
  throw new Error("expected unsupported raw HEIC input to be rejected");
} catch (error) {
  if (error instanceof Error && error.message === "expected unsupported raw HEIC input to be rejected") throw error;
}

const appendPath = buildDiaryPhotoStoragePath("pet-1", "entry-1", { uri: "file:///camera.jpg" }, 1, "mutation-1");
if (appendPath !== "pet-1/diary/entry-1/mutation-1-1-diary.jpg") {
  throw new Error("photo diary append retries must reuse a deterministic mutation-scoped storage path");
}
