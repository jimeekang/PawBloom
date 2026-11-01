import assert from "node:assert/strict";
import { AvatarError } from "../functions/generate-pet-avatar/contract.ts";
import { generateWithRetry, ProviderError } from "../functions/generate-pet-avatar/provider.ts";
import { ascii, joinBytes, jpegFixture, jpegSegment, pngFixture } from "./avatar_image_fixtures.ts";

type Reply = { status?: number; body: Record<string, unknown>; id: string };
async function tests() {
  const root = process.env.PAWBLOOM_SDK_FIXTURE_ROOT!;
  assert.equal(require(root + "/openai/7.38.0/package.json").version,"7.38.0");
  assert.equal(require(root + "/zod/4.6.7/package.json").version,"4.6.7");
  const pinnedZod = require("npm:zod@4.6.7");
  assert.ok(require("../functions/generate-pet-avatar/contract.ts").AvatarResultSchema instanceof pinnedZod.z.ZodObject);
  // The runner resolves the public cached packages: this is the real SDK, not the class mock.
  const { default: OpenAI } = require("npm:openai@7.38.0");
  assert.equal(OpenAI.name,"OpenAI");
  const { callOpenAI } = require("../functions/generate-pet-avatar/openai.ts") as typeof import("../functions/generate-pet-avatar/openai.ts");
  const originalFetch = globalThis.fetch, originalDeno = (globalThis as any).Deno;
  const appearance = { coatColor: "gray", coatPattern: "solid", accentColor: "black", eyeColor: "amber", earShape: "pointed", furLength: "short", build: "regular", tail: "long", faceMark: "none", collar: "none" };
  const result = { species: "cat", appearance, confidence: 0.9 };
  const image = { bytes: pngFixture(), mediaType: "image/png" as const };
  const ok = (text: string, extra: Record<string, unknown> = {}) => ({ object: "response", id: "resp_unit", model: "gpt-6.1-sol", status: "completed", incomplete_details: null, error: null,
    output: [{ type: "reasoning", id: "rs_unit", summary: [] }, { type: "message", id: "msg_unit", role: "assistant", status: "completed", content: [{ type: "output_text", text, annotations: [] }] }], ...extra });
  let calls = 0;
  let next: (attempt: number) => Reply;
  let expectedImage = image.bytes;
  (globalThis as any).Deno = { env: { get: (name: string) => { assert.equal(name,"OPENAI_API_KEY"); return "unit-test-not-a-real-key"; } } };
  globalThis.fetch = async (input, options) => {
    assert.equal(String(input),"https://api.openai.com/v1/responses");
    const headers = new Headers(options!.headers as HeadersInit);
    assert.equal(headers.has("openai-organization"),false); assert.equal(headers.has("openai-project"),false);
    calls++;
    const params = JSON.parse(options!.body as string);
    assert.equal(params.model,"gpt-6.1-sol"); assert.deepEqual(params.reasoning,{ effort: "high" });
    assert.equal(params.store,false); assert.equal(params.max_output_tokens,16_000);
    assert.equal(typeof params.instructions,"string");
    const format = params.text.format;
    assert.equal(format.type,"json_schema"); assert.equal(format.strict,true); assert.equal(format.name,"pawbloom_avatar");
    assert.equal("$schema" in format.schema,false); assert.equal(format.schema.additionalProperties,false);
    assert.deepEqual(format.schema.required,["species","appearance","confidence"]);
    assert.deepEqual(format.schema.properties.appearance.required,Object.keys(appearance)); assert.equal(format.schema.properties.appearance.additionalProperties,false);
    const [text, picture] = params.input[0].content;
    assert.equal(text.type,"input_text"); assert.equal(picture.type,"input_image"); assert.equal(picture.detail,"high");
    const [prefix, data] = picture.image_url.split(",");
    assert.equal(prefix,expectedImage === image.bytes ? "data:image/png;base64" : "data:image/jpeg;base64");
    assert.deepEqual(new Uint8Array(Buffer.from(data,"base64")),expectedImage,"SDK receives only metadata-free image bytes");
    const reply = next(calls);
    return new Response(JSON.stringify({ usage: { input_tokens: calls + 10, output_tokens: calls + 2, output_tokens_details: { reasoning_tokens: 1 } }, ...reply.body }),
      { status: reply.status ?? 200, headers: { "Content-Type": "application/json", "x-request-id": reply.id } });
  };
  const refusedOnce = async (body: Record<string, unknown>, stop: string, status?: number) => {
    const before = calls;
    next = () => ({ status, body, id: `req_${stop}` });
    await assert.rejects(generateWithRetry(callOpenAI,image), (error: unknown) => error instanceof ProviderError && error.code === "avatar_provider_refused"
      && error.raw?.request_id === `req_${stop}` && error.raw.stop_reason === stop);
    assert.equal(calls - before,1,`${stop} is never retried`);
  };
  try {
    next = () => ({ body: ok(JSON.stringify(result)), id: "req_success" });
    const success = await generateWithRetry(callOpenAI,image);
    assert.deepEqual(success,{ result, raw: { model: "gpt-6.1-sol", stop_reason: "completed", usage: { input_tokens: 11, output_tokens: 3 }, request_id: "req_success" } });

    await refusedOnce({ ...ok(""), output: [{ type: "message", role: "assistant", content: [{ type: "refusal", refusal: "A refusal is deliberately not JSON." }] }] },"refusal");
    await refusedOnce({ ...ok(""), status: "incomplete", incomplete_details: { reason: "content_filter" }, output: [] },"content_filter");
    await refusedOnce({ ...ok(""), status: "failed", error: { code: "image_content_policy_violation", message: "unit" }, output: [] },"failed");
    await refusedOnce({ error: { type: "invalid_request_error", code: "image_content_policy_violation", message: "unit", param: null } },"image_content_policy_violation",400);
    const beforeMixed = calls;
    next = attempt => attempt === beforeMixed + 1 ? { body: ok("not JSON"), id: "req_first" }
      : { status: 400, body: { error: { type: "invalid_request_error", code: "image_content_policy_violation", message: "unit", param: null } }, id: "req_second" };
    await assert.rejects(generateWithRetry(callOpenAI,image), (error: unknown) => error instanceof ProviderError && error.code === "avatar_provider_refused"
      && error.raw?.request_id === "req_second" && error.raw.stop_reason === "image_content_policy_violation" && error.raw.usage.input_tokens === 0);
    assert.equal(calls - beforeMixed,2,"policy stop on retry keeps its own request id");

    // Stray SDK env settings must not redirect, re-scope or log the request.
    const strayEnv = { OPENAI_BASE_URL: "https://stray.invalid/v1", OPENAI_ORG_ID: "org-unit-stray", OPENAI_PROJECT_ID: "proj-unit-stray", OPENAI_LOG: "debug" } as const;
    const savedEnv = Object.fromEntries(Object.keys(strayEnv).map(name => [name, process.env[name]]));
    const savedConsole = { debug: console.debug, info: console.info, log: console.log };
    let sdkLogs = 0;
    Object.assign(process.env, strayEnv);
    console.debug = console.info = console.log = () => { sdkLogs++; };
    try {
      next = () => ({ body: ok(JSON.stringify(result)), id: "req_stray_env" });
      assert.equal((await generateWithRetry(callOpenAI,image)).raw.request_id,"req_stray_env");
    } finally {
      Object.assign(console, savedConsole);
      for (const [name, value] of Object.entries(savedEnv)) if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    assert.equal(sdkLogs,0,"OPENAI_LOG cannot enable SDK request logging");

    for (const failure of ["max_output_tokens","json","schema","semantic"]) {
      const before = calls;
      next = attempt => attempt !== before + 1 ? { body: ok(JSON.stringify(result)), id: "req_final" }
        : failure === "max_output_tokens" ? { body: ok("{\"species\":", { status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }), id: "req_first" }
        : { body: ok(failure === "schema" ? JSON.stringify({ ...result, rationale: "removed" }) : failure === "semantic" ? JSON.stringify({ ...result, species: "dog", appearance: { ...appearance, coatPattern: "calico" } }) : "not JSON"), id: "req_first" };
      const generated = await generateWithRetry(callOpenAI,image);
      assert.equal(calls - before,2); assert.equal(generated.raw.request_id,"req_final");
      assert.deepEqual(generated.result,result);
    }
    const beforeFailure = calls;
    next = () => ({ body: ok("invalid JSON"), id: "req_failed_parse" });
    await assert.rejects(generateWithRetry(callOpenAI,image), (error: unknown) => error instanceof ProviderError && error.code === "avatar_provider_failed"
      && error.raw?.request_id === "req_failed_parse" && error.raw.stop_reason === "completed" && error.raw.usage.input_tokens === beforeFailure + 12);
    assert.equal(calls - beforeFailure,2,"parse failure retains final metadata after exactly two calls");
    const beforeLimit = calls;
    next = () => ({ body: ok("", { status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }), id: "req_limit" });
    await assert.rejects(generateWithRetry(callOpenAI,image), (error: unknown) => error instanceof ProviderError && error.code === "avatar_provider_failed" && error.raw?.stop_reason === "max_output_tokens");
    assert.equal(calls - beforeLimit,2,"output limit fails after two calls");

    const beforeInvalid = calls; let adapterCalls = 0;
    await assert.rejects(generateWithRetry(async input => { adapterCalls++; return callOpenAI(input); },{ bytes: new Uint8Array([137,80,78,71]), mediaType: "image/png" }),
      (error: unknown) => error instanceof AvatarError && error.code === "avatar_image_invalid");
    assert.equal(adapterCalls,1); assert.equal(calls,beforeInvalid,"bad container never reaches fetch or retry");

    next = () => ({ body: ok(JSON.stringify(result)), id: "req_metadata_stripped" });
    expectedImage = jpegFixture();
    const photo = joinBytes(jpegFixture([jpegSegment(0xe1,ascii("Exif\0\0unit-only")),jpegSegment(0xfe,ascii("unit-only comment"))]),ascii("SEFH-unit-only-trailer-SEFT"));
    assert.equal((await generateWithRetry(callOpenAI,{bytes:photo,mediaType:"image/jpeg"})).raw.request_id,"req_metadata_stripped");
    console.log("Actual openai 7.38.0 + zod 4.6.7: success; refusal/content_filter/failed+HTTP image policy fetch1 refused with own request id; stray OPENAI_* env ignored; max_output_tokens/JSON/schema/semantic retry2; failure usage/request_id retained; malformed fetch0; store:false, effort high, strict schema, JPEG metadata/trailer stripped.");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDeno === undefined) delete (globalThis as any).Deno; else (globalThis as any).Deno = originalDeno;
  }
}
export default process.env.PAWBLOOM_SDK_FIXTURE_ROOT ? tests() : Promise.resolve({ skipped: "actual SDK requires PAWBLOOM_SDK_FIXTURE_ROOT with cached public openai 7.38.0/zod 4.6.7 packages" });
