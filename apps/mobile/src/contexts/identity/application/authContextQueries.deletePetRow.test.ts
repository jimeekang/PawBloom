import type { PersistedPet } from "./authContextQueries";
import { deletePetRow } from "./authContextQueries";

async function canDeletePet(client: { from: (table: string) => unknown }, pet: PersistedPet) {
  await deletePetRow(client, pet.id);
}

void canDeletePet;
