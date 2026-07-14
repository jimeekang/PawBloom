import { countSavedDiaryPhotosForDate, getRemainingDiaryPhotoSlots, MAX_DIARY_PHOTOS, toDiaryPhotoInputs } from "./DiaryPhotoPicker.logic";

if (MAX_DIARY_PHOTOS !== 5 || getRemainingDiaryPhotoSlots(3) !== 2 || getRemainingDiaryPhotoSlots(6) !== 0) {
  throw new Error("diary photo sources must share one five-photo limit");
}

const normalized = toDiaryPhotoInputs([
  { uri: "file:///camera.jpg", fileName: "camera.jpg", mimeType: "image/jpeg", base64: "camera" },
  { uri: "file:///library.png", fileName: "library.png", mimeType: "image/png", base64: "library" },
], 1);

if (normalized.length !== 1 || normalized[0]?.uri !== "file:///camera.jpg" || normalized[0]?.base64 !== "camera") {
  throw new Error("picked and captured assets must normalize to the existing diary photo upload input");
}

const dailyCount = countSavedDiaryPhotosForDate([
  { id: "photo-1", petId: "pet-1", category: "photo", origin: "diary", entryDate: "2026-07-14", occurredAt: "08:00", summary: "photo", photoCount: 2 },
  { id: "memo-1", petId: "pet-1", category: "memo", origin: "diary", entryDate: "2026-07-14", occurredAt: "09:00", summary: "memo" },
  { id: "photo-2", petId: "pet-1", category: "photo", origin: "diary", entryDate: "2026-07-14", occurredAt: "10:00", summary: "photo", photoCount: 2 },
  { id: "photo-3", petId: "pet-1", category: "photo", origin: "diary", entryDate: "2026-07-13", occurredAt: "10:00", summary: "photo", photoCount: 5 },
], "2026-07-14");
if (dailyCount !== 4 || getRemainingDiaryPhotoSlots(dailyCount) !== 1) {
  throw new Error("the free diary photo limit must aggregate every photo entry for the selected date");
}

declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };
const { readFileSync } = require("node:fs") as { readFileSync(path: string, encoding: "utf8"): string };
const root = process.cwd();
const pickerSource = readFileSync(`${root}/apps/mobile/src/contexts/diary/ui/DiaryPhotoPicker.tsx`, "utf8");
if (!pickerSource.includes("savedPhotoCount") || !pickerSource.includes("totalPhotoCount")) {
  throw new Error("photo diary creation and editing must include all photos already saved that day in the shared limit");
}
for (const requiredCall of [
  "requestMediaLibraryPermissionsAsync",
  "launchImageLibraryAsync",
  "requestCameraPermissionsAsync",
  "launchCameraAsync",
]) {
  if (!pickerSource.includes(requiredCall)) throw new Error(`diary photo picker must call ${requiredCall}`);
}

const appConfig = JSON.parse(readFileSync(`${root}/apps/mobile/app.json`, "utf8")) as {
  expo: { plugins: Array<string | [string, Record<string, unknown>]> };
};
const imagePickerPlugin = appConfig.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-image-picker");
if (!Array.isArray(imagePickerPlugin) || typeof imagePickerPlugin[1]?.cameraPermission !== "string") {
  throw new Error("native app config must declare the diary camera permission message");
}
if (imagePickerPlugin[1]?.microphonePermission !== false) {
  throw new Error("photo-only diary capture must not request microphone permission");
}

const photoSectionSource = readFileSync(`${root}/apps/mobile/src/contexts/diary/ui/DiaryPhotoSection.tsx`, "utf8");
if (!photoSectionSource.includes("savedPhotoCount={savedPhotoCount}")) {
  throw new Error("editing a saved photo diary must keep the photo picker visible for appending photos");
}
