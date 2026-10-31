import assert from "node:assert/strict";
import { AvatarError } from "../functions/generate-pet-avatar/contract.ts";
import { generateWithRetry, ProviderError } from "../functions/generate-pet-avatar/provider.ts";
import { ascii, joinBytes, jpegFixture, jpegSegment, pngFixture } from "./avatar_image_fixtures.ts";

async function tests() {
  const root = process.env.PAWBLOOM_SDK_FIXTURE_ROOT!;
  assert.equal(require(root + "/@anthropic-ai/sdk/1.3.0/package.json").version,"1.3.0");
  assert.equal(require(root + "/zod/4.6.7/package.json").version,"4.6.7");
  const pinnedZod = require("npm:zod@4.6.7");
  assert.equal(require("zod/v4").ZodObject,pinnedZod.z.ZodObject,"contract and SDK helper share the exact zod instance");
  assert.ok(require("../functions/generate-pet-avatar/contract.ts").AvatarResultSchema instanceof pinnedZod.z.ZodObject);
  // The runner resolves the public cached packages: this is the real SDK, not the class mock.
  const { default: Anthropic } = require("npm:@anthropic-ai/sdk@1.3.0");
  assert.equal(Anthropic.name,"Anthropic");
  const { callClaude } = require("../functions/generate-pet-avatar/claude.ts") as typeof import("../functions/generate-pet-avatar/claude.ts");
  const originalFetch = globalThis.fetch, originalDeno = (globalThis as any).Deno;
  const appearance = { coatColor: "gray", coatPattern: "solid", accentColor: "black", eyeColor: "amber", earShape: "pointed", furLength: "short", build: "regular", tail: "long", faceMark: "none", collar: "none" };
  const result = { species: "cat", appearance, confidence: 0.9 };
  const image = { bytes: pngFixture(), mediaType: "image/png" as const };
  let calls = 0;
  let next: (attempt: number) => { stop: string; text: string; id: string };
  let expectedImage = image.bytes;
  (globalThis as any).Deno = { env: { get: (name: string) => { assert.equal(name,"CLAUDE_API_KEY"); return "unit-test-not-a-real-key"; } } };
  globalThis.fetch = async (input, options) => {
    assert.equal(String(input),"https://api.anthropic.com/v1/messages");
    calls++;
    const params = JSON.parse(options!.body as string);
    assert.equal(params.model,"claude-sonnet-5-5"); assert.equal(params.max_tokens,8000);
    assert.equal(params.output_config.effort,"high"); assert.equal(params.output_config.format.type,"json_schema");
    assert.equal("rationale" in params.output_config.format.schema.properties,false);
    assert.deepEqual(new Uint8Array(Buffer.from(params.messages[0].content[0].source.data,"base64")),expectedImage,"SDK receives only metadata-free image bytes");
    const response = next(calls);
    return new Response(JSON.stringify({ id: "msg_unit", type: "message", role: "assistant", model: "claude-sonnet-5-5",
      content: [{ type: "text", text: response.text }], stop_reason: response.stop, stop_sequence: null,
      usage: { input_tokens: calls + 10, output_tokens: calls + 2 } }),
      { headers: { "Content-Type": "application/json", "request-id": response.id } });
  };
  try {
    next = () => ({ stop: "refusal", text: "A refusal with text is deliberately not JSON.", id: "req_real_sdk_refusal" });
    await assert.rejects(generateWithRetry(callClaude,image), (error: unknown) => error instanceof ProviderError && error.code === "avatar_provider_refused" && error.raw?.request_id === "req_real_sdk_refusal" && error.raw.usage.input_tokens === 11);
    assert.equal(calls,1,"text refusal is never retried");

    for (const failure of ["max_tokens","json","schema","semantic"]) {
      const before = calls;
      next = attempt => ({ stop: failure === "max_tokens" && attempt === before + 1 ? "max_tokens" : "end_turn",
        text: attempt === before + 1 ? failure === "schema" ? JSON.stringify({ ...result, rationale: "removed" }) : failure === "semantic" ? JSON.stringify({ ...result, species: "dog", appearance: { ...appearance, coatPattern: "calico" } }) : "not JSON" : JSON.stringify(result),
        id: attempt === before + 1 ? "req_first" : "req_final" });
      const generated = await generateWithRetry(callClaude,image);
      assert.equal(calls - before,2); assert.equal(generated.raw.request_id,"req_final");
      assert.deepEqual(generated.result,result);
    }
    const beforeFailure = calls;
    next = () => ({ stop: "end_turn", text: "invalid JSON", id: "req_failed_parse" });
    await assert.rejects(generateWithRetry(callClaude,image), (error: unknown) => error instanceof ProviderError && error.code === "avatar_provider_failed"
      && error.raw?.request_id === "req_failed_parse" && error.raw.stop_reason === "end_turn" && error.raw.usage.input_tokens === beforeFailure + 12);
    assert.equal(calls - beforeFailure,2,"parse failure retains final metadata after exactly two calls");

    const beforeInvalid = calls; let adapterCalls = 0;
    await assert.rejects(generateWithRetry(async input => { adapterCalls++; return callClaude(input); },{ bytes: new Uint8Array([137,80,78,71]), mediaType: "image/png" }),
      (error: unknown) => error instanceof AvatarError && error.code === "avatar_image_invalid");
    assert.equal(adapterCalls,1); assert.equal(calls,beforeInvalid,"bad container never reaches fetch or retry");

    next = () => ({ stop: "end_turn", text: JSON.stringify(result), id: "req_metadata_stripped" });
    expectedImage = jpegFixture();
    const photo = joinBytes(jpegFixture([jpegSegment(0xe1,ascii("Exif\0\0unit-only")),jpegSegment(0xfe,ascii("unit-only comment"))]),ascii("SEFH-unit-only-trailer-SEFT"));
    assert.equal((await generateWithRetry(callClaude,{bytes:photo,mediaType:"image/jpeg"})).raw.request_id,"req_metadata_stripped");
    console.log("Actual SDK 1.3.0 + zod 4.6.7: text refusal fetch1; max_tokens/JSON/schema/semantic retry2; failure usage/request_id retained; malformed fetch0; transmitted JPEG metadata/trailer stripped.");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDeno === undefined) delete (globalThis as any).Deno; else (globalThis as any).Deno = originalDeno;
  }
}
export default process.env.PAWBLOOM_SDK_FIXTURE_ROOT ? tests() : Promise.resolve({ skipped: "actual SDK requires PAWBLOOM_SDK_FIXTURE_ROOT with cached public SDK1.3.0/zod4.6.7 packages" });
