import OpenAI from "npm:openai@7.38.0";
import { AvatarError, AvatarResultJsonSchema } from "./contract.ts";
import { MODEL, providerFailureDiagnostic, type ProviderAdapter } from "./provider.ts";
import { SYSTEM_PROMPT, USER_PROMPT } from "./prompt.ts";
import { stripImageMetadata } from "./imageMetadata.ts";

export const callOpenAI: ProviderAdapter = async ({ bytes, mediaType }) => {
  try {
    const cleaned = stripImageMetadata(bytes, mediaType);
    if (Object.keys(cleaned.removed).length) console.info("Avatar image metadata removed", cleaned.removed);
    let requestId: string | null = null;
    // Explicit values override the SDK's env fallbacks (OPENAI_BASE_URL/ORG_ID/PROJECT_ID/LOG): stray secrets cannot redirect,
    // re-scope or log the photo request. OPENAI_CUSTOM_HEADERS has no explicit override in the SDK; never set that secret.
    const client = new OpenAI({
      apiKey: Deno.env.get("OPENAI_API_KEY"), baseURL: "https://api.openai.com/v1", organization: null, project: null, logLevel: "off",
      maxRetries: 0, timeout: 60_000,
      fetch: async (input, init) => {
        const response = await fetch(input, init);
        requestId = response.headers.get("x-request-id");
        return response;
      },
    });
    let binary = "";
    for (let offset = 0; offset < cleaned.bytes.length; offset += 8192) binary += String.fromCharCode(...cleaned.bytes.subarray(offset, offset + 8192));
    // store:false keeps no response state at OpenAI; detail "high" caps the image at 2,500 patches (bounded cost, never rejected for size).
    const response = await client.responses.create({
      model: MODEL, reasoning: { effort: "high" }, store: false, max_output_tokens: 16_000,
      instructions: SYSTEM_PROMPT,
      input: [{ role: "user", content: [
        { type: "input_text", text: USER_PROMPT },
        { type: "input_image", image_url: `data:${mediaType};base64,${btoa(binary)}`, detail: "high" },
      ] }],
      text: { format: { type: "json_schema", name: "pawbloom_avatar", strict: true, schema: AvatarResultJsonSchema } },
    });
    return { status: response.status ?? null, incomplete_reason: response.incomplete_details?.reason ?? null,
      error_code: response.error?.code ?? null, output: response.output, usage: response.usage, _request_id: requestId };
  } catch (error) {
    if (error instanceof AvatarError && error.code === "avatar_image_invalid") throw error;
    // Fixed categories/status only: provider text, keys, image bytes and prompts must never enter logs.
    console.warn("Avatar provider request failed", providerFailureDiagnostic(error));
    throw error;
  }
};
