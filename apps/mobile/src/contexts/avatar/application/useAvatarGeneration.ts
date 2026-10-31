import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PetProfile } from "../../pet/domain/pet";
import type { Appearance } from "../domain/appearance";
import { AvatarGenerationError, isAvatarGenerationRetryable, type AvatarGenerationErrorCode, type AvatarGenerationResult, type AvatarPhotoInput } from "../domain/avatarGeneration";
import { applyGeneratedAvatar, findGeneratedAvatar, generateAvatar } from "./avatarGenerationRepository";

export type AvatarGenerationState = { phase: "idle" } | { phase: "uploading" } | { phase: "generating" } | { phase: "ready"; result: AvatarGenerationResult } | { phase: "failed"; code: AvatarGenerationErrorCode; retryable: boolean };
export function useAvatarGeneration(userId: string | null, pet: PetProfile): {
  state: AvatarGenerationState;
  pending: AvatarGenerationResult | null;
  start(photo: AvatarPhotoInput): Promise<void>;
  apply(result: AvatarGenerationResult): Promise<Appearance>;
  reset(): void;
} {
  const client = useQueryClient();
  const scope = JSON.stringify([userId, pet.id, pet.species, pet.role]);
  const active = useRef({ scope, version: 0, busy: false });
  if (active.current.scope !== scope) active.current = { scope, version: active.current.version + 1, busy: false };
  const [snapshot, setSnapshot] = useState<{ scope: string; state: AvatarGenerationState }>({ scope, state: { phase: "idle" } });
  useEffect(() => () => { active.current.version++; active.current.busy = false; }, [scope]);
  const pendingKey = ["avatar-generation", userId, pet.id] as const;
  const pendingQuery = useQuery({
    queryKey: pendingKey, enabled: Boolean(userId && pet.role === "owner"), retry: false,
    queryFn: () => findGeneratedAvatar(pet.id, false),
  });
  const update = (state: AvatarGenerationState) => setSnapshot({ scope, state });
  const failure = (error: unknown): AvatarGenerationState => {
    const code = error instanceof AvatarGenerationError ? error.code : "avatar_unknown";
    return { phase: "failed", code, retryable: isAvatarGenerationRetryable(code) };
  };
  return {
    state: snapshot.scope === scope ? snapshot.state : { phase: "idle" },
    pending: userId && pet.role === "owner" ? pendingQuery.data ?? null : null,
    async start(photo) {
      if (active.current.scope !== scope || active.current.busy) return;
      const version = ++active.current.version;
      const current = () => active.current.scope === scope && active.current.version === version;
      active.current.busy = true;
      update({ phase: "uploading" });
      try {
        const result = await generateAvatar(userId, pet, photo, () => { if (current()) update({ phase: "generating" }); });
        if (current()) {
          await client.cancelQueries({ queryKey: pendingKey, exact: true });
          if (current()) {
            client.setQueryData(pendingKey, result);
            update({ phase: "ready", result });
          }
        }
      } catch (error) { if (current()) update(failure(error)); }
      finally { if (current()) active.current.busy = false; }
    },
    async apply(result) {
      if (active.current.scope !== scope) throw new AvatarGenerationError("avatar_owner_required");
      if (active.current.busy) throw new AvatarGenerationError("avatar_in_progress");
      const version = ++active.current.version;
      const current = () => active.current.scope === scope && active.current.version === version;
      active.current.busy = true;
      try {
        const saved = await applyGeneratedAvatar(userId, pet, result);
        const queryKey = ["appearance", userId, pet.id, pet.species] as const;
        await client.cancelQueries({ queryKey, exact: true });
        client.setQueryData(queryKey, saved);
        await client.cancelQueries({ queryKey: pendingKey, exact: true });
        client.setQueryData(pendingKey, null);
        if (current()) update({ phase: "idle" });
        return saved;
      } catch (error) {
        if (current()) update(failure(error));
        throw error;
      } finally { if (current()) active.current.busy = false; }
    },
    reset() {
      if (active.current.scope !== scope) return;
      active.current.version++;
      active.current.busy = false;
      update({ phase: "idle" });
    },
  };
}
