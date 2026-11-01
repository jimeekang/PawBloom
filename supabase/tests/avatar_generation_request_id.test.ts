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
  let responseFor: (params: any) => Promise<Response>;
  class FakeOpenAI {
    responses: { create: (params: any) => Promise<any> };
    constructor(options: any) {
      clients++;
      assert.equal(options.apiKey, "unit-test-not-a-real-key");
      assert.equal(options.baseURL, "https://api.openai.com/v1");
      assert.equal(options.organization, null); assert.equal(options.project, null); assert.equal(options.logLevel, "off");
      assert.equal(options.maxRetries, 0);
      assert.equal(options.timeout, 60_000);
      this.responses = { create: (params) => {
        assert.equal(params.model, "gpt-6.1-sol");
        assert.deepEqual(params.reasoning, { effort: "high" });
        assert.equal(params.store, false);
        assert.equal(params.max_output_tokens, 16_000);
        assert.equal(params.text.format.type, "json_schema"); assert.equal(params.text.format.strict, true);
        for (const forbidden of ["temperature", "tools", "tool_choice", "previous_response_id", "background", "stream"]) assert.equal(forbidden in params, false);
        assert.deepEqual(params.input.map((message: any) => message.role), ["user"]);
        assert.deepEqual(params.input[0].content.map((part: any) => part.type), ["input_text", "input_image"]);
        assert.equal(params.input[0].content[1].detail, "high");
        // Exercise the raw create response; the adapter reads the header from its own fetch wrapper.
        return options.fetch("https://api.openai.com/v1/responses", { method: "POST", body: JSON.stringify(params) }).then(async (response: Response) => {
          assert.equal(response.bodyUsed, false, "adapter must return the original, unconsumed Response");
          const body = await response.json();
          return Object.defineProperty(body, "_request_id", { value: response.headers.get("x-request-id"), enumerable: false });
        });
      } };
    }
  }
  Module._load = function(request: string, parent: unknown, main: boolean) {
    if (request === "npm:openai@7.38.0") return { __esModule: true, default: FakeOpenAI };
    return originalLoad.call(this, request, parent, main);
  };
  let callOpenAI: typeof import("../functions/generate-pet-avatar/openai.ts").callOpenAI;
  try { ({ callOpenAI } = require("../functions/generate-pet-avatar/openai.ts")); }
  finally { Module._load = originalLoad; }
  (globalThis as any).Deno = { env: { get: (name: string) => { assert.equal(name, "OPENAI_API_KEY"); return "unit-test-not-a-real-key"; } } };
  globalThis.fetch = async (_input, init) => {
    fetchCalls++;
    assert.equal(init?.method, "POST");
    return responseFor(JSON.parse(init!.body as string));
  };
  const sdkResponse = (requestId: string | null, kind: "completed" | "max_output_tokens" | "refusal" = "completed") => new Response(JSON.stringify({ object: "response", model: "gpt-6.1-sol",
    status: kind === "max_output_tokens" ? "incomplete" : "completed", incomplete_details: kind === "max_output_tokens" ? { reason: "max_output_tokens" } : null, error: null,
    output: [{ type: "message", role: "assistant", content: [kind === "refusal" ? { type: "refusal", refusal: "Unit refusal text is not JSON." } : { type: "output_text", text: JSON.stringify(result) }] }],
    usage: { input_tokens: 7, output_tokens: 3, output_tokens_details: { reasoning_tokens: 2 } } }), {
    headers: { ...(requestId === null ? {} : { "x-request-id": requestId }), "x-private-test": "not-stored" },
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
    assert.equal((await generateAvatar({ jobId: id }, "owner", store, callOpenAI)).status, 200);
    assert.deepEqual(finishedRaw, { model: "gpt-6.1-sol", stop_reason: "completed", usage: { input_tokens: 7, output_tokens: 3 }, request_id: "req_adapter_header" });
    assert.deepEqual(Object.keys(finishedRaw!).sort(), ["model", "request_id", "stop_reason", "usage"]);

    const previous = fetchCalls;
    responseFor = async () => sdkResponse(fetchCalls === previous + 1 ? "req_first_attempt" : "req_final_attempt", fetchCalls === previous + 1 ? "max_output_tokens" : "completed");
    const retried = await generateWithRetry(callOpenAI, { bytes: png, mediaType: "image/png" });
    assert.equal(fetchCalls - previous, 2);
    assert.equal(retried.raw.request_id, "req_final_attempt");

    responseFor = async () => sdkResponse(null);
    assert.equal((await generateWithRetry(callOpenAI, { bytes: png, mediaType: "image/png" })).raw.request_id, null, "absent header cannot reuse a previous ID");

    const beforeRefusal = fetchCalls;
    responseFor = async () => sdkResponse("req_refusal", "refusal");
    await assert.rejects(generateWithRetry(callOpenAI, { bytes: png, mediaType: "image/png" }), (error: unknown) => error instanceof ProviderError && error.code === "avatar_provider_refused" && error.raw?.request_id === "req_refusal");
    assert.equal(fetchCalls - beforeRefusal, 1);

    responseFor = async (params) => {
      const data = params.input[0].content[1].image_url;
      const first = data === `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
      if (first) await Promise.resolve();
      return sdkResponse(first ? "req_parallel_a" : "req_parallel_b");
    };
    const [a, b] = await Promise.all([
      callOpenAI({ bytes: png, mediaType: "image/png" }),
      callOpenAI({ bytes: pngFixture([],true), mediaType: "image/png" }),
    ]);
    assert.equal(a._request_id, "req_parallel_a");
    assert.equal(b._request_id, "req_parallel_b");
    assert.equal(clients, fetchCalls, "each adapter attempt owns a separate client and ID closure");
  } finally {
    delete require.cache[require.resolve("../functions/generate-pet-avatar/openai.ts")];
    globalThis.fetch = originalFetch;
    if (originalDeno === undefined) delete (globalThis as any).Deno;
    else (globalThis as any).Deno = originalDeno;
  }
}
export default tests();
