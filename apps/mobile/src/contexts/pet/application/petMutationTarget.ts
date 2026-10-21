import { useEffect, useRef } from "react";
import { useMutation, type QueryClient, type UseMutationOptions, type UseMutationResult } from "@tanstack/react-query";
import { getLocalDateKey } from "../../../shared-kernel/date";
import { createUuid } from "../../../shared-kernel/uuid";

/** Captured synchronously at mutation entry; never follows activePet. */
export type PetMutationTarget = Readonly<{ userId: string | null; petId: string | null; dateKey: string; mutationId: string; epoch: number }>;
const inputTargets = new WeakMap<object, PetMutationTarget>();
export function getPetMutationTarget(input: object) { return inputTargets.get(input); }
let current: { userId: string | null; pets: Set<string>; epochs: Map<string, number>; session: number } | undefined;
/** Auth owner calls this even while the shell is gated/unmounted. Revocation is irreversible for in-flight work. */
export function updatePetMutationAccess(userId: string | null, petIds: readonly string[], client?: QueryClient) {
  const previous = current;
  if (previous && client) {
    const removed = [...previous.pets].filter((id) => previous.userId !== userId || !petIds.includes(id));
    const predicate = (query: { queryKey: readonly unknown[] }) => ["diary", "medication_doses", "care_setup", "pet_routine"].includes(String(query.queryKey[0])) && query.queryKey.at(-1) === previous.userId && removed.some((id) => query.queryKey.includes(id));
    void client.cancelQueries({ predicate }); client.removeQueries({ predicate });
  }
  if (!current || current.userId !== userId) current = { userId, pets: new Set(), epochs: new Map(), session: (current?.session ?? 0) + 1 };
  const next = new Set(petIds);
  for (const id of new Set([...current.pets, ...next])) if (current.pets.has(id) !== next.has(id)) current.epochs.set(id, (current.epochs.get(id) ?? 0) + 1);
  current.pets = next;
}
function epoch(petId: string | null) { return current ? current.session * 1_000_000 + (current.epochs.get(petId ?? "") ?? 0) : 0; }
export function capturePetMutationTarget(userId: string | null, petId: string | null, dateKey = getLocalDateKey(), mutationId = createUuid()): PetMutationTarget {
  return Object.freeze({ userId, petId, dateKey, mutationId, epoch: epoch(petId) });
}
export function isPetMutationTargetCurrent(target: PetMutationTarget) {
  return !current || current.userId === target.userId && Boolean(target.petId && current.pets.has(target.petId)) && target.epoch === epoch(target.petId);
}

/** Freezes the complete hook options closure at public mutate entry, before React Query's first await.
 * Per-call callbacks keep the public React Query signature and are dropped after access/account loss. */
export function usePetMutation<TData, TError = Error, TVariables = void, TContext = unknown>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>, petId: string | null, userId: string | null, freezeInput?: (input: TVariables, target: PetMutationTarget) => TVariables,
): UseMutationResult<TData, TError, TVariables, TContext> {
  const lifetime = useRef({ alive: true });
  useEffect(() => { lifetime.current = { alive: true }; const mounted = lifetime.current; return () => { mounted.alive = false; }; }, []);
  type Envelope = { mounted: { alive: boolean }; input: TVariables; options: typeof options; target: PetMutationTarget };
  const mutation = useMutation<TData, TError, Envelope, TContext>({
    ...options,
    mutationFn: (entry, context) => {
      if (!entry.mounted.alive || !isPetMutationTargetCurrent(entry.target)) return Promise.reject(new Error("Mutation target is no longer accessible"));
      return entry.options.mutationFn!(entry.input, context);
    },
    onMutate: (entry, context) => (entry.mounted.alive && isPetMutationTargetCurrent(entry.target) ? entry.options.onMutate?.(entry.input, context) : undefined) as TContext | Promise<TContext>,
    onSuccess: (data, entry, context, mutationContext) => { if (entry.mounted.alive && isPetMutationTargetCurrent(entry.target)) return entry.options.onSuccess?.(data, entry.input, context, mutationContext); },
    onError: (error, entry, context, mutationContext) => { if (entry.mounted.alive && isPetMutationTargetCurrent(entry.target)) return entry.options.onError?.(error, entry.input, context, mutationContext); },
    onSettled: (data, error, entry, context, mutationContext) => { if (entry.mounted.alive && isPetMutationTargetCurrent(entry.target)) return entry.options.onSettled?.(data, error, entry.input, context, mutationContext); },
  });
  const envelope = (input: TVariables): Envelope => { const target = capturePetMutationTarget(userId, petId); const captured = freezeInput ? freezeInput(input, target) : input && typeof input === "object" ? { ...input } : input; if (captured && typeof captured === "object") inputTargets.set(captured, target); return { mounted: lifetime.current, input: captured, options, target }; };
  return {
    ...mutation, variables: mutation.variables?.input,
    mutate: (input, callbacks) => { const entry = envelope(input); mutation.mutate(entry, callbacks && {
      onSuccess: (data, _entry, context, mutationContext) => { if (entry.mounted.alive && isPetMutationTargetCurrent(entry.target)) callbacks.onSuccess?.(data, input, context, mutationContext); },
      onError: (error, _entry, context, mutationContext) => { if (entry.mounted.alive && isPetMutationTargetCurrent(entry.target)) callbacks.onError?.(error, input, context, mutationContext); },
      onSettled: (data, error, _entry, context, mutationContext) => { if (entry.mounted.alive && isPetMutationTargetCurrent(entry.target)) callbacks.onSettled?.(data, error, input, context, mutationContext); },
    }); },
    mutateAsync: (input, callbacks) => { const entry = envelope(input); return mutation.mutateAsync(entry, callbacks && {
      onSuccess: (data, _entry, context, mutationContext) => { if (entry.mounted.alive && isPetMutationTargetCurrent(entry.target)) callbacks.onSuccess?.(data, input, context, mutationContext); },
      onError: (error, _entry, context, mutationContext) => { if (entry.mounted.alive && isPetMutationTargetCurrent(entry.target)) callbacks.onError?.(error, input, context, mutationContext); },
      onSettled: (data, error, _entry, context, mutationContext) => { if (entry.mounted.alive && isPetMutationTargetCurrent(entry.target)) callbacks.onSettled?.(data, error, input, context, mutationContext); },
    }); },
  } as UseMutationResult<TData, TError, TVariables, TContext>;
}
