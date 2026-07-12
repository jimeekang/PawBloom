export type ProfileSaveResult<T> = {
  profile: T;
  photoSaved: boolean;
  photoError?: unknown;
};

// The profile row is the source of truth. Once it saves, an optional photo failure
// becomes a recoverable warning so retrying the form cannot create a duplicate pet.
export async function savePetProfileWithOptionalPhoto<T>({
  saveProfile,
  savePhoto,
}: {
  saveProfile: () => Promise<T>;
  savePhoto?: (profile: T) => Promise<unknown>;
}): Promise<ProfileSaveResult<T>> {
  const profile = await saveProfile();
  if (!savePhoto) return { profile, photoSaved: false };

  try {
    await savePhoto(profile);
    return { profile, photoSaved: true };
  } catch (photoError) {
    return { profile, photoSaved: false, photoError };
  }
}
