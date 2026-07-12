import { createPetRow } from "./authContextQueries";

let insertedPayload: Record<string, unknown> | null = null;
let selectedAfterInsert = false;
const client = {
  from: (table: string) => {
    if (table !== "pets") throw new Error("unexpected table");
    return {
      insert: (payload: Record<string, unknown>) => {
        insertedPayload = payload;
        return {
          select: () => {
            selectedAfterInsert = true;
            return {
              single: async () => ({
                data: { id: "pet-created", name: "Milo", species: "dog", breed: null, birthdate: null, weight_kg: null },
                error: null,
              }),
            };
          },
        };
      },
    };
  },
};

const created = await createPetRow(client, "user-1", { name: " Milo ", species: "dog" });
if (!selectedAfterInsert || created.id !== "pet-created") {
  throw new Error("pet creation must return the exact inserted row instead of querying the newest account pet");
}
const persistedPayload = insertedPayload as Record<string, unknown> | null;
if (persistedPayload?.owner_id !== "user-1" || persistedPayload?.name !== "Milo") {
  throw new Error("pet creation must preserve ownership and normalized name");
}
