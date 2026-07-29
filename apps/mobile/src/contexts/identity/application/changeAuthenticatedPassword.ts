type PasswordChangeOperation = () => Promise<{ error: unknown | null }>;

export async function changeAuthenticatedPassword({
  reauthenticate,
  updatePassword,
}: {
  reauthenticate: PasswordChangeOperation;
  updatePassword: PasswordChangeOperation;
}) {
  const reauthentication = await reauthenticate();
  if (reauthentication.error) return reauthentication.error;

  const update = await updatePassword();
  return update.error;
}
