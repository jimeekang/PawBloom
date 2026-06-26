import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";

export type ServiceClient = ReturnType<typeof createClient>;

export function serviceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function requireUser(request: Request, supabase = serviceClient()) {
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!token) {
    throw new Error("Missing bearer token");
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Error("Invalid bearer token");
  }

  return data.user;
}

export async function requirePetMember(supabase: ServiceClient, petId: string, userId: string, roles?: string[]) {
  let query = supabase
    .from("pet_members")
    .select("role")
    .eq("pet_id", petId)
    .eq("user_id", userId)
    .or("starts_at.is.null,starts_at.lte.now()")
    .or("ends_at.is.null,ends_at.gte.now()");

  if (roles?.length) {
    query = query.in("role", roles);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    throw new Error("Pet access denied");
  }

  return data;
}

export async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

