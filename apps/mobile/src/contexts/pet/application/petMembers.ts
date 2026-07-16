import { FunctionsHttpError } from "@supabase/supabase-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../shared-kernel/supabase/client";
import type { PetMemberRole } from "../../../shared-kernel/types";

export type PetMemberStatus = "active" | "invited";

export type PetMember = {
  membershipId: string;
  email: string;
  role: PetMemberRole;
  status: PetMemberStatus;
  startsAt: string | null;
  endsAt: string | null;
  isCurrentUser: boolean;
};

export type PetMemberErrorCode =
  | "accountRequired"
  | "ownerRequired"
  | "familyPlanRequired"
  | "invalidEmail"
  | "cannotInviteSelf"
  | "alreadyMember"
  | "inviteDeliveryFailed"
  | "memberListFailed"
  | "memberRemoveFailed"
  | "memberRequestFailed";

export const petMemberKeys = {
  list: (petId: string | null, userId: string | null) => ["pet_members", "managed", petId, userId] as const,
};

export function usePetMembers(petId: string | null, userId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: petMemberKeys.list(petId, userId),
    enabled: Boolean(enabled && supabase && petId && userId),
    queryFn: async () => {
      const data = await invokePetMemberAction({ action: "list", petId: petId! });
      return parseMemberList(data);
    },
  });
}

export function useInvitePetMember(petId: string | null, userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      if (!petId) throw new PetMemberRequestError("memberRequestFailed");
      const data = await invokePetMemberAction({ action: "invite", petId, email });
      const member = parseMember(data && typeof data === "object" ? (data as { member?: unknown }).member : null);
      if (!member) throw new PetMemberRequestError("memberRequestFailed");
      return member;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: petMemberKeys.list(petId, userId) }),
  });
}

export function useRemovePetMember(petId: string | null, userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (membershipId: string) => {
      if (!petId) throw new PetMemberRequestError("memberRequestFailed");
      await invokePetMemberAction({ action: "remove", petId, membershipId });
      return membershipId;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: petMemberKeys.list(petId, userId) }),
  });
}

export class PetMemberRequestError extends Error {
  constructor(readonly code: PetMemberErrorCode) {
    super(code);
    this.name = "PetMemberRequestError";
  }
}

async function invokePetMemberAction(body: Record<string, string>) {
  if (!supabase) throw new PetMemberRequestError("accountRequired");
  const { data, error } = await supabase.functions.invoke<unknown>("manage-pet-members", { body });
  if (error) throw new PetMemberRequestError(await readPetMemberErrorCode(error));
  return data;
}

async function readPetMemberErrorCode(error: unknown): Promise<PetMemberErrorCode> {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.clone().json() as { error?: unknown };
      if (typeof payload.error === "string" && isPetMemberErrorCode(payload.error)) return payload.error;
    } catch {
      return "memberRequestFailed";
    }
  }
  return "memberRequestFailed";
}

function parseMemberList(input: unknown): PetMember[] {
  if (!input || typeof input !== "object" || !Array.isArray((input as { members?: unknown }).members)) return [];
  return (input as { members: unknown[] }).members.flatMap((member) => {
    const parsed = parseMember(member);
    return parsed ? [parsed] : [];
  });
}

function parseMember(input: unknown): PetMember | null {
  if (!input || typeof input !== "object") return null;
  const member = input as Partial<PetMember>;
  if (
    typeof member.membershipId !== "string"
    || typeof member.email !== "string"
    || !isPetMemberRole(member.role)
    || !isPetMemberStatus(member.status)
    || typeof member.isCurrentUser !== "boolean"
  ) return null;
  return {
    membershipId: member.membershipId,
    email: member.email,
    role: member.role,
    status: member.status,
    startsAt: typeof member.startsAt === "string" ? member.startsAt : null,
    endsAt: typeof member.endsAt === "string" ? member.endsAt : null,
    isCurrentUser: member.isCurrentUser,
  };
}

function isPetMemberRole(value: unknown): value is PetMemberRole {
  return value === "owner" || value === "caregiver" || value === "pet_sitter";
}

function isPetMemberStatus(value: unknown): value is PetMemberStatus {
  return value === "active" || value === "invited";
}

function isPetMemberErrorCode(value: string): value is PetMemberErrorCode {
  return [
    "accountRequired", "ownerRequired", "familyPlanRequired", "invalidEmail", "cannotInviteSelf",
    "alreadyMember", "inviteDeliveryFailed", "memberListFailed", "memberRemoveFailed", "memberRequestFailed",
  ].includes(value);
}
