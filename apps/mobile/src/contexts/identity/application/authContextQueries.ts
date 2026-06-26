import { type User } from "@supabase/supabase-js";
import { mapDbPet, normalizeSpecies, type PetProfile, type PetRecord } from "../../pet/domain/pet";

export type CreatePetInput = {
  name: string;
  species: string;
  breed?: string;
  birthdate?: string;
  weightKg?: number;
};

export type PersistedPet = PetProfile;

type QueryClient = {
  from: (table: string) => any;
};
export async function ensureProfileRow(client: QueryClient, authUser: User): Promise<void> {
  await (client.from("profiles") as any).upsert(
    {
      id: authUser.id,
      email: authUser.email ?? null,
    },
    { onConflict: "id" },
  );
}

export async function loadPetRows(client: QueryClient): Promise<PetRecord[]> {
  const { data, error } = (await (client.from("pets") as any)
    .select("id,name,species,breed,birthdate,weight_kg")
    .order("created_at", { ascending: false })) as {
    data: PetRecord[] | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    throw new Error(error?.message ?? "Could not load pets.");
  }

  return data;
}

export async function createPetRow(client: QueryClient, userId: string, input: CreatePetInput): Promise<PersistedPet> {
  const species = normalizeSpecies(input.species);
  const weightKg = input.weightKg !== undefined && !Number.isNaN(input.weightKg) ? input.weightKg : null;

  const { error: insertError } = (await (client.from("pets") as any)
    .insert({
      owner_id: userId,
      name: input.name.trim(),
      species,
      breed: input.breed?.trim() || null,
      birthdate: input.birthdate?.trim() || null,
      weight_kg: weightKg,
    }) as any);

  if (insertError) {
    throw new Error(insertError.message ?? "Could not create pet.");
  }

  const { data, error } = (await (client.from("pets") as any)
    .select("id,name,species,breed,birthdate,weight_kg")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()) as {
    data: PetRecord | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    throw new Error(error?.message ?? "Could not create pet.");
  }

  return mapDbPet(data);
}
