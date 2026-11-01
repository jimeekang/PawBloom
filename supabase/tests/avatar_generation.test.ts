import assert from "node:assert/strict";
import { AvatarError, errorStatus, parseAvatarResult, parseJobId, readyResponse, validateImage } from "../functions/generate-pet-avatar/contract.ts";
import { generateWithRetry, providerFailureDiagnostic } from "../functions/generate-pet-avatar/provider.ts";
import { generateAvatar, type GenerationStore } from "../functions/generate-pet-avatar/handler.ts";
const id = "00000000-0000-4000-8000-000000000001";
const appearance = { coatColor: "gray", coatPattern: "solid", accentColor: "black", eyeColor: "amber", earShape: "pointed", furLength: "short", build: "regular", tail: "long", faceMark: "none", collar: "none" };
const result = { species: "cat", appearance, confidence: 0.9 };
const output = (text: string) => [{ type: "reasoning", summary: [] }, { type: "message", role: "assistant", content: [{ type: "output_text", text }] }];
const refusal = [{ type: "message", role: "assistant", content: [{ type: "refusal", refusal: "PRIVATE refusal text" }] }];
const response = { status: "completed", output: output(JSON.stringify(result)), usage: { input_tokens: 22, output_tokens: 11, secret: "private" }, _request_id: "request-1", photo: "secret-photo" };
const png = new Uint8Array(24); png.set([137,80,78,71,13,10,26,10]);
function rejectsCode(code: string) { return (error: unknown) => error instanceof AvatarError && error.code === code; }
async function tests() {
  const sensitive = Object.assign(new Error("PRIVATE_PROVIDER_TEXT schema PRIVATE_KEY_OR_PHOTO"), { status: 401, headers: { Authorization: "PRIVATE_TOKEN" }, body: "PRIVATE_BODY" });
  assert.deepEqual(providerFailureDiagnostic(sensitive), { category: "authentication", httpStatus: 401 });
  assert.deepEqual(providerFailureDiagnostic(new Error("PRIVATE schema input")), { category: "sdk_schema", httpStatus: null });
  assert.deepEqual(providerFailureDiagnostic({ status: Number.NaN, message: "PRIVATE" }), { category: "unknown", httpStatus: null });
  assert.deepEqual(providerFailureDiagnostic({ status: 404 }), { category: "model", httpStatus: 404 });
  assert.equal(JSON.stringify(providerFailureDiagnostic(sensitive)).includes("PRIVATE"), false);
  assert.equal(parseJobId({ jobId: id }), id);
  assert.throws(() => parseJobId({ jobId: id, injected: true }), rejectsCode("avatar_invalid_input"));
  assert.throws(() => parseJobId({ jobId: "not-uuid" }), rejectsCode("avatar_invalid_input"));
  assert.deepEqual(parseAvatarResult(result), result);
  for (const invalid of [ { ...result, confidence: -1 }, { ...result, rationale: "removed field" }, { ...result, appearance: { ...appearance, coatColor: "pink" } },
    { ...result, species: "dog", appearance: { ...appearance, coatPattern: "calico" } },
    { ...result, appearance: { ...appearance, coatPattern: "pointed" } } ]) {
    assert.throws(() => parseAvatarResult(invalid), rejectsCode("avatar_provider_failed"));
  }
  assert.equal(validateImage(png, "image/png", png.length), "image/png");
  assert.throws(() => validateImage(png, "image/jpeg", png.length), rejectsCode("avatar_image_invalid"));
  assert.throws(() => validateImage(png, "image/png", 5 * 1024 * 1024 + 1), rejectsCode("avatar_image_too_large"));
  assert.throws(() => validateImage(png, "image/png", 1), rejectsCode("avatar_image_invalid"));
  const expectedStatuses = { avatar_owner_required:403, avatar_invalid_input:400, avatar_daily_limit:429, avatar_image_too_large:413,
    avatar_image_invalid:400, avatar_provider_refused:422, avatar_provider_failed:502, avatar_no_pet_found:422,
    avatar_in_progress:409, avatar_not_found:404, avatar_job_closed:409, avatar_unknown:500 } as const;
  for (const [code, status] of Object.entries(expectedStatuses)) assert.equal(errorStatus(code as keyof typeof expectedStatuses), status);
  const generated = await generateWithRetry(async () => response, { bytes: png, mediaType: "image/png" });
  assert.deepEqual(generated.raw, { model: "gpt-6.1-sol", stop_reason: "completed", usage: { input_tokens: 22, output_tokens: 11 }, request_id: "request-1" });
  let calls = 0;
  for (const stop of [{ output: refusal }, { status: "incomplete", incomplete_reason: "content_filter", output: [] }, { status: "failed", error_code: "image_content_policy_violation", output: [] }]) {
    calls = 0;
    await assert.rejects(generateWithRetry(async () => { calls++; return { ...response, ...stop }; }, { bytes: png, mediaType: "image/png" }),
      (error: unknown) => rejectsCode("avatar_provider_refused")(error) && (error as { raw?: { stop_reason?: string } }).raw?.stop_reason === (stop.status === "incomplete" ? "content_filter" : stop.status === "failed" ? "failed" : "refusal"));
    assert.equal(calls, 1, "refusal, content filter and image policy stops are never retried");
  }
  calls = 0;
  await assert.rejects(generateWithRetry(async () => { if (++calls === 1) return { ...response, output: output("not JSON"), _request_id: "req_first" };
    throw Object.assign(new Error("PRIVATE policy text"), { status: 400, code: "image_content_policy_violation", requestID: "req_second" }); }, { bytes: png, mediaType: "image/png" }),
    (error: unknown) => rejectsCode("avatar_provider_refused")(error) && JSON.stringify((error as { raw?: unknown }).raw) === JSON.stringify({ model: "gpt-6.1-sol", stop_reason: "image_content_policy_violation", usage: { input_tokens: 0, output_tokens: 0 }, request_id: "req_second" }));
  assert.equal(calls, 2, "HTTP image policy error after a parse failure is refused with its own metadata, not retried");
  for (const failure of ["network", "null", "max_output_tokens", "failed", "schema"]) {
    calls = 0;
    await assert.rejects(generateWithRetry(async () => {
      calls++;
      if (failure === "network") throw new Error("secret provider error");
      return { ...response, output: failure === "null" ? [] : output(JSON.stringify(failure === "schema" ? {} : result)),
        ...(failure === "max_output_tokens" ? { status: "incomplete", incomplete_reason: "max_output_tokens" } : failure === "failed" ? { status: "failed", error_code: "server_error" } : {}) };
    }, { bytes: png, mediaType: "image/png" }), rejectsCode("avatar_provider_failed"));
    assert.equal(calls, 2);
  }
  calls = 0;
  await generateWithRetry(async () => { if (++calls === 1) throw new Error("temporary"); return response; }, { bytes: png, mediaType: "image/png" });
  assert.equal(calls, 2);
  const stored = { id: "avatar", job_id: id, created_at: "2026-10-31T00:00:00.000Z", manifest: { ...result, appearance: { version: 1, ...appearance } } };
  const mapped = readyResponse(stored);
  assert.equal(mapped.createdAt, stored.created_at);
  assert.equal(mapped.appearance.version, 1);
  assert.equal("rationale" in mapped, false);
  let events: string[] = [];
  let status = "processing";
  const store: GenerationStore = {
    claim: async () => ({ id, pet_id: "pet", status, source_path: "pet/job/source", source_content_type: "image/png", source_byte_size: png.length }),
    readAvatar: async () => stored,
    download: async () => ({ bytes: png, contentType: "image/png" }),
    finish: async (_id, _user, _result, _raw, error) => { events.push(`finish:${error ?? "success"}`); },
    reserveCleanup: async () => { events.push("reserve"); },
    removeSource: async () => { events.push("remove"); },
    acknowledgeCleanup: async () => { events.push("ack"); },
  };
  const success = await generateAvatar({ jobId: id }, "owner", store, async () => response);
  assert.equal(success.status, 200);
  assert.deepEqual(events, ["finish:success", "reserve", "remove", "ack"]);
  status = "ready"; events = []; calls = 0;
  const ready = await generateAvatar({ jobId: id }, "owner", store, async () => { calls++; return response; });
  assert.equal(ready.status, 200); assert.equal(calls, 0); assert.deepEqual(events, ["reserve", "remove", "ack"]);
  status = "processing"; events = [];
  const refused = await generateAvatar({ jobId: id }, "owner", store, async () => ({ ...response, output: refusal }));
  assert.deepEqual(refused, { status: 422, body: { error: "avatar_provider_refused" } });
  assert.deepEqual(events, ["finish:avatar_provider_refused", "reserve", "remove", "ack"]);
  events = [];
  const noPet = await generateAvatar({ jobId: id }, "owner", store, async () => ({ ...response, output: output(JSON.stringify({ ...result, species: "other", confidence: 0.2 })) }));
  assert.equal(noPet.status, 422); assert.ok(events.includes("finish:avatar_no_pet_found"));
  events = [];
  const failed = await generateAvatar({ jobId: id }, "owner", store, async () => { throw new Error("PRIVATE: provider text"); });
  assert.deepEqual(failed, { status: 502, body: { error: "avatar_provider_failed" } });
  assert.ok(events.includes("remove"));
  events = [];
  const deniedStore = { ...store, claim: async () => ({ error: "avatar_not_found" as const }) };
  assert.equal((await generateAvatar({ jobId: id }, "other", deniedStore, async () => response)).status, 404);
  assert.deepEqual(events, []);
  const processingStore = { ...store, claim: async () => ({ error: "avatar_in_progress" as const }) };
  assert.equal((await generateAvatar({ jobId: id }, "owner", processingStore, async () => response)).status, 409);
  assert.deepEqual(events, []);
  const dailyStore = { ...store, claim: async () => ({ id, status: "failed", source_path: "path", error: "avatar_daily_limit" as const }) };
  assert.equal((await generateAvatar({ jobId: id }, "owner", dailyStore, async () => response)).status, 429);
  assert.deepEqual(events, ["reserve", "remove", "ack"]);
  events = [];
  const unavailableStorage = { ...store, removeSource: async () => { events.push("remove-failed"); throw new Error("network"); } };
  assert.equal((await generateAvatar({ jobId: id }, "owner", unavailableStorage, async () => response)).status, 200);
  assert.ok(events.includes("reserve")); assert.ok(!events.includes("ack"));
}
export default tests();
