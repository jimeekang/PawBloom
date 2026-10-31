import { AvatarError, parseAvatarResult, type AvatarResult, type ImageType } from "./contract.ts";
export const MODEL = "claude-sonnet-5-5";
export type ProviderRaw = { model: string; stop_reason: string | null; usage: { input_tokens: number; output_tokens: number }; request_id: string | null };
export type ProviderResponse = { content: unknown; stop_reason: string | null; usage?: unknown; _request_id?: unknown };
export type ClaudeAdapter = (image: { bytes: Uint8Array; mediaType: ImageType }) => Promise<ProviderResponse>;
export type ProviderResult = { result: AvatarResult; raw: ProviderRaw };
export class ProviderError extends AvatarError {
  constructor(code: "avatar_provider_refused" | "avatar_provider_failed", public raw: ProviderRaw | null) { super(code); }
}
function metadata(response: ProviderResponse): ProviderRaw {
  const usage = response.usage as Record<string, unknown> | undefined;
  const count = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
  return { model: MODEL, stop_reason: response.stop_reason,
    usage: { input_tokens: count(usage?.input_tokens), output_tokens: count(usage?.output_tokens) },
    request_id: typeof response._request_id === "string" ? response._request_id : null };
}
export async function generateWithRetry(adapter: ClaudeAdapter, image: Parameters<ClaudeAdapter>[0]): Promise<ProviderResult> {
  let raw: ProviderRaw | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await adapter(image);
      raw = metadata(response);
      if (response.stop_reason === "refusal") throw new ProviderError("avatar_provider_refused", raw);
      if (response.stop_reason === "max_tokens") throw new ProviderError("avatar_provider_failed", raw);
      const text = Array.isArray(response.content) ? response.content.filter(block => block?.type === "text" && typeof block.text === "string").map(block => block.text).join("") : "";
      return { result: parseAvatarResult(JSON.parse(text)), raw };
    } catch (error) {
      if (error instanceof AvatarError && error.code === "avatar_image_invalid") throw error;
      if (error instanceof ProviderError && error.code === "avatar_provider_refused") throw error;
      if (attempt === 1) throw new ProviderError("avatar_provider_failed", raw);
    }
  }
  throw new ProviderError("avatar_provider_failed", raw);
}

export function providerFailureDiagnostic(error: unknown) {
  const candidate = error && typeof error === "object" && "status" in error ? error.status : null;
  const httpStatus = typeof candidate === "number" && Number.isInteger(candidate) && candidate >= 100 && candidate <= 599 ? candidate : null;
  const message = error instanceof Error ? error.message : "";
  const category = httpStatus === 401 || httpStatus === 403 ? "authentication" : httpStatus === 404 ? "model"
    : httpStatus !== null ? "api_http" : /apiKey|authentication method|api key/i.test(message) ? "authentication"
    : /schema|zod|parse.*not a function/i.test(message) ? "sdk_schema" : /network|connection|fetch/i.test(message) ? "network" : "unknown";
  return { category, httpStatus };
}
