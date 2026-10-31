import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk@1.3.0/helpers/zod";
import { AvatarError, AvatarResultSchema } from "./contract.ts";
import { MODEL, providerFailureDiagnostic, type ClaudeAdapter } from "./provider.ts";
import { SYSTEM_PROMPT, USER_PROMPT } from "./prompt.ts";
import { stripImageMetadata } from "./imageMetadata.ts";

export const callClaude: ClaudeAdapter = async ({ bytes, mediaType }) => {
  try {
    const cleaned = stripImageMetadata(bytes, mediaType);
    if (Object.keys(cleaned.removed).length) console.info("Avatar image metadata removed", cleaned.removed);
    let requestId: string | null = null;
    const client = new Anthropic({
      apiKey: Deno.env.get("CLAUDE_API_KEY"), maxRetries: 0, timeout: 60_000,
      fetch: async (input, init) => {
        const response = await fetch(input, init);
        requestId = response.headers.get("request-id");
        return response;
      },
    });
    let binary = "";
    for (let offset = 0; offset < cleaned.bytes.length; offset += 8192) binary += String.fromCharCode(...cleaned.bytes.subarray(offset, offset + 8192));
    const response = await client.messages.create({
      model: MODEL, max_tokens: 8000,
      output_config: { effort: "high", format: zodOutputFormat(AvatarResultSchema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: btoa(binary) } },
        { type: "text", text: USER_PROMPT },
      ] }],
    });
    return { content: response.content, stop_reason: response.stop_reason, usage: response.usage, _request_id: requestId };
  } catch (error) {
    if (error instanceof AvatarError && error.code === "avatar_image_invalid") throw error;
    // Fixed categories/status only: provider text, keys, image bytes and prompts must never enter logs.
    console.warn("Avatar provider request failed", providerFailureDiagnostic(error));
    throw error;
  }
};
