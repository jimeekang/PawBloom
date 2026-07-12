export type CareSetupSaveScope = { petId: string | null; generation: number };

export function nextCareSetupSaveScope(current: CareSetupSaveScope, petId?: string): CareSetupSaveScope {
  const nextPetId = petId ?? null;
  return current.petId === nextPetId ? current : { petId: nextPetId, generation: current.generation + 1 };
}

export function isCurrentCareSetupSave(current: CareSetupSaveScope, request: CareSetupSaveScope) {
  return current.petId === request.petId && current.generation === request.generation;
}

export function resolvePendingCareSetupMutation(
  current: { fingerprint: string; id: string } | null,
  fingerprint: string,
  createId: () => string,
) {
  return current?.fingerprint === fingerprint ? current : { fingerprint, id: createId() };
}
