import assert from "node:assert/strict";
import { generateWithRetry, ProviderError, type ProviderRaw } from "../functions/generate-pet-avatar/provider.ts";
import { pngFixture } from "./avatar_image_fixtures.ts";
import { generateAvatar, type GenerationStore } from "../functions/generate-pet-avatar/handler.ts";

const appearance = { coatColor: "gray", coatPattern: "solid", accentColor: "black", eyeColor: "amber", earShape: "pointed", furLength: "short", build: "regular", tail: "long", faceMark: "none", collar: "none" };
const result = { species: "cat", appearance, confidence: 0.9 };
const png = pngFixture();
const id = "00000000-0000-4000-8000-000000000001";
const stored = { id: "avatar", job_id: id, created_at: "2026-10-31T00:00:00.000Z", manifest: { ...result, appearance: { version: 1, ...appearance } } };

async function tests() {
  const Module = require("node:module");
  const originalLoad = Module._load;
  const originalFetch = globalThis.fetch;
  const originalDeno = (globalThis as any).Deno;
  let clients = 0;
  let fetchCalls = 0;
  const format = { type: "json_schema", schema: { fixture: true } };
  let responseFor: (params: any) => Promise<Response>;
  class FakeAnthropic {
    messages: { create: (params: any) => Promise<any> };
    constructor(options: any) {
      clients++;
      assert.equal(options.apiKey, "unit-test-not-a-real-key");
      assert.equal(options.maxRetries, 0);
      assert.equal(options.timeout, 60_000);
      this.messages = { create: (params) => {
        assert.equal(params.model, "claude-sonnet-5-5");
        assert.equal(params.max_tokens, 8000);
        assert.deepEqual(params.output_config, { effort: "high", format });
        for (const forbidden of ["thinking", "budget_tokens", "temperature", "tool_choice", "fallbacks"]) assert.equal(forbidden in params, false);
        assert.deepEqual(params.messages.map((message: any) => message.role), ["user"]);
        assert.equal(params.messages[0].content[0].source.type, "base64");
        // Exercise the raw create response; text refusal must never enter structured parsing.
        return options.fetch("https://api.anthropic.com/v1/messages", { method: "POST", body: JSON.stringify(params) }).then(async (response: Response) => {
          assert.equal(response.bodyUsed, false, "adapter must return the original, unconsumed Response");
          const body = await response.json();
          const message = Object.defineProperty(body, "_request_id", { value: response.headers.get("request-id"), enumerable: false });
          return message;
        });
      } };
    }
  }
  Module._load = function(request: string, parent: unknown, main: boolean) {
    if (request === "npm:@anthropic-ai/sdk@1.3.0") return { __esModule: true, default: FakeAnthropic };
    if (request === "npm:@anthropic-ai/sdk@1.3.0/helpers/zod") return { zodOutputFormat: () => format };
    return originalLoad.call(this, request, parent, main);
  };
  let callClaude: typeof import("../functions/generate-pet-avatar/claude.ts").callClaude;
  try { ({ callClaude } = require("../functions/generate-pet-avatar/claude.ts")); }
  finally { Module._load = originalLoad; }
  (globalThis as any).Deno = { env: { get: (name: string) => { assert.equal(name, "CLAUDE_API_KEY"); return "unit-test-not-a-real-key"; } } };
  globalThis.fetch = async (_input, init) => {
    fetchCalls++;
    assert.equal(init?.method, "POST");
    return responseFor(JSON.parse(init!.body as string));
  };
  const sdkResponse = (requestId: string | null, stop = "end_turn") => new Response(JSON.stringify({ content: [{ type: "text", text: stop === "refusal" ? "Unit refusal text is not JSON." : JSON.stringify(result) }], stop_reason: stop, usage: { input_tokens: 7, output_tokens: 3 } }), {
    headers: { ...(requestId === null ? {} : { "request-id": requestId }), "x-private-test": "not-stored" },
  });
  try {
    responseFor = async () => sdkResponse("req_adapter_header");
    let finishedRaw: ProviderRaw | null = null;
    const store: GenerationStore = {
      claim: async () => ({ id, pet_id: "pet", status: "processing", source_path: "pet/job/source", source_content_type: "image/png", source_byte_size: png.length }),
      readAvatar: async () => stored,
      download: async () => ({ bytes: png, contentType: "image/png" }),
      finish: async (_job, _requester, _result, raw) => { finishedRaw = raw; },
      reserveCleanup: async () => {}, removeSource: async () => {}, acknowledgeCleanup: async () => {},
    };
    assert.equal((await generateAvatar({ jobId: id }, "owner", store, callClaude)).status, 200);
    assert.deepEqual(finishedRaw, { model: "claude-sonnet-5-5", stop_reason: "end_turn", usage: { input_tokens: 7, output_tokens: 3 }, request_id: "req_adapter_header" });
    assert.deepEqual(Object.keys(finishedRaw!).sort(), ["model", "request_id", "stop_reason", "usage"]);

    const previous = fetchCalls;
    responseFor = async () => sdkResponse(fetchCalls === previous + 1 ? "req_first_attempt" : "req_final_attempt", fetchCalls === previous + 1 ? "max_tokens" : "end_turn");
    const retried = await generateWithRetry(callClaude, { bytes: png, mediaType: "image/png" });
    assert.equal(fetchCalls - previous, 2);
    assert.equal(retried.raw.request_id, "req_final_attempt");

    responseFor = async () => sdkResponse(null);
    assert.equal((await generateWithRetry(callClaude, { bytes: png, mediaType: "image/png" })).raw.request_id, null, "absent header cannot reuse a previous ID");

    const beforeRefusal = fetchCalls;
    responseFor = async () => sdkResponse("req_refusal", "refusal");
    await assert.rejects(generateWithRetry(callClaude, { bytes: png, mediaType: "image/png" }), (error: unknown) => error instanceof ProviderError && error.code === "avatar_provider_refused" && error.raw?.request_id === "req_refusal");
    assert.equal(fetchCalls - beforeRefusal, 1);

    responseFor = async (params) => {
      const data = params.messages[0].content[0].source.data;
      if (data === Buffer.from(png).toString("base64")) await Promise.resolve();
      return sdkResponse(data === Buffer.from(png).toString("base64") ? "req_parallel_a" : "req_parallel_b");
    };
    const [a, b] = await Promise.all([
      callClaude({ bytes: png, mediaType: "image/png" }),
      callClaude({ bytes: pngFixture([],true), mediaType: "image/png" }),
    ]);
    assert.equal(a._request_id, "req_parallel_a");
    assert.equal(b._request_id, "req_parallel_b");
    assert.equal(clients, fetchCalls, "each adapter attempt owns a separate client and ID closure");
  } finally {
    delete require.cache[require.resolve("../functions/generate-pet-avatar/claude.ts")];
    globalThis.fetch = originalFetch;
    if (originalDeno === undefined) delete (globalThis as any).Deno;
    else (globalThis as any).Deno = originalDeno;
  }
}
export default tests();
