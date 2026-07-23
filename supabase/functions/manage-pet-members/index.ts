import { corsHeaders, errorResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { requireUser, serviceClient, type ServiceClient } from "../_shared/supabase.ts";
import { PetMemberRequestError, parsePetMemberRequest } from "./contract.ts";

type MemberRow = {
  id: string;
  user_id: string;
  role: "owner" | "caregiver" | "pet_sitter";
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

class PetMemberActionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "PetMemberActionError";
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return errorResponse("methodNotAllowed", 405);

  try {
    const supabase = serviceClient();
    const user = await requireUser(request, supabase);
    const body = parsePetMemberRequest(await readJson<unknown>(request));
    await requirePetOwner(supabase, body.petId, user.id);

    if (body.action === "list") {
      return jsonResponse({ members: await listMembers(supabase, body.petId, user.id) });
    }
    if (body.action === "invite") {
      await requireFamilyPlan(supabase, user.id);
      const member = await inviteCaregiver(supabase, body.petId, user.id, body.email);
      return jsonResponse({ member }, 201);
    }

    await removeMember(supabase, body.petId, user.id, body.membershipId);
    return jsonResponse({ membershipId: body.membershipId });
  } catch (error) {
    if (error instanceof PetMemberRequestError) return errorResponse(error.message, 400);
    if (error instanceof PetMemberActionError) return errorResponse(error.message, error.status);
    const message = error instanceof Error ? error.message : "memberRequestFailed";
    if (message === "Invalid JSON body") return errorResponse("invalidRequest", 400);
    if (message === "Missing bearer token" || message === "Invalid bearer token") return errorResponse("accountRequired", 401);
    if (message === "Pet access denied") return errorResponse("ownerRequired", 403);
    console.error("manage-pet-members failed", error);
    return errorResponse("memberRequestFailed", 500);
  }
});

async function requirePetOwner(supabase: ServiceClient, petId: string, userId: string) {
  const { data, error } = await supabase
    .from("pets")
    .select("id")
    .eq("id", petId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("Pet access denied");
}

async function listMembers(supabase: ServiceClient, petId: string, currentUserId: string) {
  const { data, error } = await supabase
    .from("pet_members")
    .select("id,user_id,role,starts_at,ends_at,created_at")
    .eq("pet_id", petId)
    .order("created_at", { ascending: true });
  if (error) throw new PetMemberActionError("memberListFailed", 500);

  const rows = (data ?? []) as MemberRow[];
  const authUsers = await Promise.all(rows.map(async (row) => {
    const result = await supabase.auth.admin.getUserById(row.user_id);
    return { row, user: result.data.user ?? null };
  }));

  return authUsers
    .map(({ row, user }) => ({
      membershipId: row.id,
      email: user?.email ?? "",
      role: row.role,
      status: user?.email_confirmed_at ? "active" : "invited",
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      isCurrentUser: row.user_id === currentUserId,
    }))
    .sort((left, right) => Number(right.role === "owner") - Number(left.role === "owner"));
}

async function requireFamilyPlan(supabase: ServiceClient, userId: string) {
  const { data, error } = await supabase
    .from("subscription_entitlements")
    .select("plan,active_until")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new PetMemberActionError("entitlementLoadFailed", 500);
  const activeUntil = data?.active_until ? Date.parse(data.active_until) : null;
  const active = activeUntil === null || (Number.isFinite(activeUntil) && activeUntil >= Date.now());
  if (data?.plan !== "family" || !active) throw new PetMemberActionError("familyPlanRequired", 403);
}

async function inviteCaregiver(supabase: ServiceClient, petId: string, actorUserId: string, email: string) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,email")
    .ilike("email", email)
    .maybeSingle();
  if (profileError) throw new PetMemberActionError("memberLookupFailed", 500);
  if (profile?.id === actorUserId) throw new PetMemberActionError("cannotInviteSelf", 409);

  let invitedUserId = profile?.id ?? null;
  let createdInviteUser = false;
  if (!invitedUserId) {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: "pawbloom://auth",
    });
    if (error || !data.user) throw new PetMemberActionError("inviteDeliveryFailed", 502);
    invitedUserId = data.user.id;
    createdInviteUser = true;
  }

  const { data: existing, error: existingError } = await supabase
    .from("pet_members")
    .select("id")
    .eq("pet_id", petId)
    .eq("user_id", invitedUserId)
    .maybeSingle();
  if (existingError) throw new PetMemberActionError("memberLookupFailed", 500);
  if (existing) throw new PetMemberActionError("alreadyMember", 409);

  const { error: insertError } = await supabase.from("pet_members").insert({
    pet_id: petId,
    user_id: invitedUserId,
    role: "caregiver",
  });
  if (insertError) {
    if (insertError.code === "23505") throw new PetMemberActionError("alreadyMember", 409);
    if (createdInviteUser) await supabase.auth.admin.deleteUser(invitedUserId).catch(() => undefined);
    throw new PetMemberActionError("inviteSaveFailed", 500);
  }

  await writeAuditEvent(supabase, actorUserId, petId, "member.invited", { invitedUserId });
  return (await listMembers(supabase, petId, actorUserId))
    .find((member) => member.email.toLowerCase() === email) ?? null;
}

async function removeMember(supabase: ServiceClient, petId: string, actorUserId: string, membershipId: string) {
  const { data: membership, error } = await supabase
    .from("pet_members")
    .select("id,user_id,role")
    .eq("id", membershipId)
    .eq("pet_id", petId)
    .maybeSingle();
  if (error || !membership) throw new PetMemberActionError("memberNotFound", 404);
  if (membership.role === "owner") throw new PetMemberActionError("ownerCannotBeRemoved", 409);

  const { error: deleteError } = await supabase
    .from("pet_members")
    .delete()
    .eq("id", membershipId)
    .eq("pet_id", petId);
  if (deleteError) throw new PetMemberActionError("memberRemoveFailed", 500);
  await writeAuditEvent(supabase, actorUserId, petId, "member.removed", { removedUserId: membership.user_id });
}

async function writeAuditEvent(supabase: ServiceClient, actorUserId: string, petId: string, eventType: string, metadata: Record<string, string>) {
  const { error } = await supabase.from("audit_events").insert({
    actor_user_id: actorUserId,
    pet_id: petId,
    event_type: eventType,
    metadata,
  });
  if (error) console.error("pet member audit insert failed", error);
}
