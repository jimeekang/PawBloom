import type { QueryClient } from "@tanstack/react-query";
/** All accessible pets refresh after a record changes; queued records remain visible until replay. */
export function invalidateTodayCare(client: QueryClient, userId: string | null, queued = false) {
  return client.invalidateQueries({ predicate: (query) => ["diary", "medication_doses", "pet_routine", "care_setup"].includes(String(query.queryKey[0])) && query.queryKey.at(-1) === userId, refetchType: queued ? "none" : "active" });
}
