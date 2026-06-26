import { type Session, type User } from "@supabase/supabase-js";
import { type PetProfile } from "../../pet/domain/pet";
import { type CreatePetInput } from "./authContextQueries";

export type AppAuthState = {
  configured: boolean;
  initialized: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  pets: PetProfile[];
  activePet: PetProfile | null;
  error: string | null;
  authMessage: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  createPet: (input: CreatePetInput) => Promise<string | null>;
  selectPet: (petId: string) => void;
  selectNextPet: () => void;
  resetMessage: () => void;
};
