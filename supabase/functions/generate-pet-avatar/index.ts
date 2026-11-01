import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";
import { callOpenAI } from "./openai.ts";
import { AvatarError } from "./contract.ts";
import { generateAvatar, type GenerationStore } from "./handler.ts";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "avatar_invalid_input" }, 405, { "Cache-Control": "no-store" });
  const supabase = serviceClient();
  let user;
  try { user = await requireUser(request, supabase); }
  catch { return jsonResponse({ error: "avatar_owner_required" }, 401, { "Cache-Control": "no-store" }); }
  let input: unknown;
  try { input = await request.json(); }
  catch { return jsonResponse({ error: "avatar_invalid_input" }, 400, { "Cache-Control": "no-store" }); }
  const storage = supabase.storage.from("pet-avatars");
  const store: GenerationStore = {
    async claim(jobId, requesterId) {
      const { data, error } = await supabase.rpc("claim_pet_avatar_job_v1", { p_job_id: jobId, p_requester_id: requesterId });
      if (error) throw new AvatarError("avatar_unknown");
      return data;
    },
    async readAvatar(jobId) {
      const { data, error } = await supabase.from("pet_avatars").select("id,job_id,created_at,manifest")
        .eq("job_id", jobId).eq("manifest_version", "parametric-v3").eq("validation_status", "validated").single();
      if (error || !data) throw new AvatarError("avatar_unknown");
      return data;
    },
    async download(path) {
      const { data, error } = await storage.download(path);
      if (error || !data) throw new AvatarError("avatar_image_invalid");
      return { bytes: new Uint8Array(await data.arrayBuffer()), contentType: data.type };
    },
    async finish(jobId, requesterId, result, raw, code) {
      const { data, error } = await supabase.rpc("finish_pet_avatar_job_v1", {
        p_job_id: jobId, p_requester_id: requesterId, p_result: result, p_provider_raw: raw, p_error_code: code,
      });
      if (error || data?.error) throw new AvatarError("avatar_unknown");
    },
    async reserveCleanup(jobId, requesterId) {
      const { error } = await supabase.rpc("queue_pet_avatar_source_cleanup_v1", { p_job_id: jobId, p_requester_id: requesterId });
      if (error) throw error;
    },
    async removeSource(path) {
      const { error } = await storage.remove([path]);
      if (error && String(error.statusCode) !== "404") throw error;
    },
    async acknowledgeCleanup(path) {
      const { error } = await supabase.rpc("complete_resource_cleanup_v1", { p_bucket_id: "pet-avatars", p_storage_path: path });
      if (error) throw error;
    },
  };
  const result = await generateAvatar(input, user.id, store, callOpenAI);
  return jsonResponse(result.body, result.status, { "Cache-Control": "no-store" });
});
