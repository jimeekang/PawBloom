import { type Session, type User } from "@supabase/supabase-js";
import { type PetProfile } from "../../pet/domain/pet";
import { type CreatePetInput, type UpdatePetInput } from "./authContextQueries";
import type { IdentityMessageKey } from "./identityMessage";

// Result of the in-app account deletion action (Apple Guideline 5.1.1(v)). The
// deletion is orchestrated by useAccountDeletion.ts, which returns this shape so
// callers can react to success/failure without inspecting Supabase internals.
export type AccountDeletionResult = { ok: boolean };

export type AppAuthState = {
  configured: boolean;
  initialized: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  pets: PetProfile[];
  activePet: PetProfile | null;
  petLoadStatus: "idle" | "loading" | "ready" | "error";
  error: IdentityMessageKey | null;
  authMessage: IdentityMessageKey | null;
  signIn: (email: string, password: string) => Promise<IdentityMessageKey | null>;
  signUp: (email: string, password: string) => Promise<IdentityMessageKey | null>;
  signOut: () => Promise<void>;
  createPet: (input: CreatePetInput) => Promise<IdentityMessageKey | null>;
  updatePet: (input: UpdatePetInput) => Promise<IdentityMessageKey | null>;
  deletePet: (petId: string) => Promise<IdentityMessageKey | null>;
  selectPet: (petId: string) => void;
  selectNextPet: () => void;
  retryPetLoad: () => void;
  resetMessage: () => void;
};
