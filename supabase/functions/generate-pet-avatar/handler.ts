import { AvatarError, errorStatus, parseJobId, readyResponse, validateImage, type AvatarErrorCode } from "./contract.ts";
import { generateWithRetry, ProviderError, type ClaudeAdapter, type ProviderRaw } from "./provider.ts";
export type AvatarJob = { id: string; pet_id: string; source_path: string; source_content_type: string; source_byte_size: number; status: string; error?: AvatarErrorCode };
export type StoredAvatar = Parameters<typeof readyResponse>[0];
export type GenerationStore = {
  claim(jobId: string, requesterId: string): Promise<Partial<AvatarJob> & { error?: AvatarErrorCode }>;
  readAvatar(jobId: string): Promise<StoredAvatar>;
  download(path: string): Promise<{ bytes: Uint8Array; contentType: string }>;
  finish(jobId: string, requesterId: string, result: unknown, raw: ProviderRaw | null, error: AvatarErrorCode | null): Promise<void>;
  reserveCleanup(jobId: string, requesterId: string): Promise<void>;
  removeSource(path: string): Promise<void>;
  acknowledgeCleanup(path: string): Promise<void>;
};
export async function generateAvatar(input: unknown, requesterId: string, store: GenerationStore, adapter: ClaudeAdapter) {
  let job: AvatarJob | null = null;
  let claimed = false;
  let raw: ProviderRaw | null = null;
  try {
    const jobId = parseJobId(input);
    const claim = await store.claim(jobId, requesterId);
    if (claim.id && claim.source_path) job = claim as AvatarJob;
    if (claim.error) throw new AvatarError(claim.error);
    if (!job) throw new AvatarError("avatar_unknown");
    if (job.status === "ready") return { status: 200, body: readyResponse(await store.readAvatar(job.id)) };
    claimed = true;
    const source = await store.download(job.source_path);
    if (source.contentType !== job.source_content_type) throw new AvatarError("avatar_image_invalid");
    const mediaType = validateImage(source.bytes, job.source_content_type, Number(job.source_byte_size));
    const generated = await generateWithRetry(adapter, { bytes: source.bytes, mediaType });
    raw = generated.raw;
    if (generated.result.species === "other" || generated.result.confidence < 0.35) throw new AvatarError("avatar_no_pet_found");
    await store.finish(job.id, requesterId, { ...generated.result, appearance: { version: 1, ...generated.result.appearance } }, raw, null);
    claimed = false;
    return { status: 200, body: readyResponse(await store.readAvatar(job.id)) };
  } catch (error) {
    const code = error instanceof AvatarError ? error.code : "avatar_unknown";
    if (error instanceof ProviderError) raw = error.raw;
    if (claimed && job) {
      try { await store.finish(job.id, requesterId, null, raw, code); } catch { /* The durable source reservation below still protects deletion. */ }
    }
    return { status: errorStatus(code), body: { error: code } };
  } finally {
    // Never delete a competing processing request's source. Terminal claims and our admitted work own cleanup.
    if (job && (job.status === "ready" || job.status === "failed" || claimed || job.status === "processing")) {
      try {
        await store.reserveCleanup(job.id, requesterId);
        await store.removeSource(job.source_path);
        await store.acknowledgeCleanup(job.source_path);
      } catch { /* Keep the durable queue entry for delete-account's cleanup worker. */ }
    }
  }
}
