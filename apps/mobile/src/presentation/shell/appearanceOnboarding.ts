import { useEffect, useState } from "react";

type Ticket = { userId: string; existingIds: readonly string[]; confirmed: boolean };
let ticket: Ticket | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
/** Survives the first-pet App gate unmount without changing Auth's create contract. */
export function beginAppearanceOnboarding(userId: string, existingIds: readonly string[]) {
  const request = { userId, existingIds: [...existingIds], confirmed: false };
  ticket = request;
  return (succeeded: boolean) => {
    if (ticket !== request) return;
    ticket = succeeded ? { ...request, confirmed: true } : null;
    notify();
  };
}
export function consumeAppearanceOnboarding(userId: string | null, pets: readonly { id: string; role: string }[]): string | null {
  if (!ticket) return null;
  if (userId !== ticket.userId) { ticket = null; return null; }
  if (!ticket.confirmed) return null;
  const added = pets.filter((pet) => !ticket!.existingIds.includes(pet.id) && pet.role === "owner");
  if (!added.length) return null;
  ticket = null;
  return added.length === 1 ? added[0].id : null;
}
export function useAppearanceOnboarding(userId: string | null, pets: readonly { id: string; role: string }[], onReady: (petId: string) => void) {
  const [revision, setRevision] = useState(0);
  useEffect(() => { const listener = () => setRevision((value) => value + 1); listeners.add(listener); return () => { listeners.delete(listener); }; }, []);
  const key = JSON.stringify(pets.map((pet) => [pet.id, pet.role]));
  useEffect(() => { const id = consumeAppearanceOnboarding(userId, pets); if (id) onReady(id); }, [userId, key, revision]);
}
