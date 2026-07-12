import { loadPetRows } from "./authContextQueries";

let membershipUserFilter: string | null = null;
let membershipPetFilter: string[] = [];
const petRecord = { id: "pet-1", name: "Milo", species: "dog", breed: null, birthdate: null, weight_kg: null };

const client = {
  from: (table: string) => {
    if (table === "pets") {
      return {
        select: () => ({
          order: async () => ({ data: [petRecord], error: null }),
        }),
      };
    }
    if (table === "pet_members") {
      return {
        select: () => ({
          eq: (_column: string, userId: string) => {
            membershipUserFilter = userId;
            return {
              in: async (_petColumn: string, petIds: string[]) => {
                membershipPetFilter = petIds;
                return { data: [{ pet_id: "pet-1", role: "caregiver" }], error: null };
              },
            };
          },
        }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  },
};

const rows = await loadPetRows(client, "user-caregiver");
if (rows[0]?.membershipRole !== "caregiver") throw new Error("loaded pets must keep the authenticated member role");
if (membershipUserFilter !== "user-caregiver") throw new Error("membership lookup must be restricted to the authenticated user");
if (membershipPetFilter.length !== 1 || membershipPetFilter[0] !== "pet-1") throw new Error("membership lookup must be restricted to loaded pets");

const missingMembershipClient = {
  from: (table: string) => table === "pets"
    ? { select: () => ({ order: async () => ({ data: [petRecord], error: null }) }) }
    : { select: () => ({ eq: () => ({ in: async () => ({ data: [], error: null }) }) }) },
};

const rowsAfterRevocationRace = await loadPetRows(missingMembershipClient, "user-1");
if (rowsAfterRevocationRace.length !== 0) {
  throw new Error("a pet missing its current-user membership must be filtered without granting a fallback role");
}

const expiredMembershipClient = {
  from: (table: string) => table === "pets"
    ? { select: () => ({ order: async () => ({ data: [petRecord], error: null }) }) }
    : { select: () => ({ eq: () => ({ in: async () => ({ data: [{ pet_id: "pet-1", role: "caregiver", ends_at: "2020-01-01T00:00:00.000Z" }], error: null }) }) }) },
};
if ((await loadPetRows(expiredMembershipClient, "user-1")).length !== 0) {
  throw new Error("expired pet memberships must not remain actionable in auth state");
}
