import { type Session, type User } from "@supabase/supabase-js";
import { type PetProfile } from "../../pet/domain/pet";
import { type CreatePetInput, type UpdatePetInput } from "./authContextQueries";
import type { IdentityMessageKey } from "./identityMessage";

export type AppAuthState = {
  configured: boolean;
  initialized: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  pets: PetProfile[];
  activePet: PetProfile | null;
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
  resetMessage: () => void;
};
