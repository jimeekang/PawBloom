import { AvatarError, parseAvatarResult, type AvatarResult, type ImageType } from "./contract.ts";
export const MODEL = "gpt-6.1-sol";
export type ProviderRaw = { model: string; stop_reason: string | null; usage: { input_tokens: number; output_tokens: number }; request_id: string | null };
export type ProviderResponse = { status: string | null; incomplete_reason?: string | null; error_code?: string | null; output: unknown; usage?: unknown; _request_id?: unknown };
export type ProviderAdapter = (image: { bytes: Uint8Array; mediaType: ImageType }) => Promise<ProviderResponse>;
export type ProviderResult = { result: AvatarResult; raw: ProviderRaw };
export class ProviderError extends AvatarError {
  constructor(code: "avatar_provider_refused" | "avatar_provider_failed", public raw: ProviderRaw | null) { super(code); }
}
type Part = { type?: unknown; text?: unknown };
function parts(response: ProviderResponse): Part[] {
  if (!Array.isArray(response.output)) return [];
  return response.output.flatMap(item => item?.type === "message" && Array.isArray(item.content) ? item.content as Part[] : []);
}
function metadata(response: ProviderResponse, refusalItem: boolean): ProviderRaw {
  const usage = response.usage as Record<string, unknown> | undefined;
  const count = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
  // Reasoning tokens are already counted inside output_tokens.
  return { model: MODEL, stop_reason: refusalItem ? "refusal" : response.status === "incomplete" ? response.incomplete_reason ?? "incomplete" : response.status,
    usage: { input_tokens: count(usage?.input_tokens), output_tokens: count(usage?.output_tokens) },
    request_id: typeof response._request_id === "string" ? response._request_id : null };
}
export async function generateWithRetry(adapter: ProviderAdapter, image: Parameters<ProviderAdapter>[0]): Promise<ProviderResult> {
  let raw: ProviderRaw | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await adapter(image);
      const content = parts(response);
      // Refusals and safety stops are final: retrying the same photo cannot change the outcome.
      const refusalItem = content.some(part => part?.type === "refusal");
      const refused = refusalItem || response.status === "incomplete" && response.incomplete_reason === "content_filter"
        || response.status === "failed" && response.error_code === "image_content_policy_violation";
      raw = metadata(response, refusalItem);
      if (refused) throw new ProviderError("avatar_provider_refused", raw);
      if (response.status !== "completed") throw new ProviderError("avatar_provider_failed", raw);
      const text = content.filter(part => part?.type === "output_text" && typeof part.text === "string").map(part => part.text).join("");
      return { result: parseAvatarResult(JSON.parse(text)), raw };
    } catch (error) {
      if (error instanceof AvatarError && error.code === "avatar_image_invalid") throw error;
      if (error instanceof ProviderError && error.code === "avatar_provider_refused") throw error;
      // The same image policy stop can also arrive as an HTTP error (SDK APIError.code); record this attempt, not the previous one.
      const failure = error instanceof AvatarError ? null : error as { code?: unknown; requestID?: unknown } | null;
      if (failure?.code === "image_content_policy_violation") {
        throw new ProviderError("avatar_provider_refused", { model: MODEL, stop_reason: failure.code, usage: { input_tokens: 0, output_tokens: 0 },
          request_id: typeof failure.requestID === "string" ? failure.requestID : null });
      }
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
    : httpStatus !== null ? "api_http" : /apiKey|credentials|authentication method|api key/i.test(message) ? "authentication"
    : /schema|zod|parse.*not a function/i.test(message) ? "sdk_schema" : /network|connection|fetch/i.test(message) ? "network" : "unknown";
  return { category, httpStatus };
}
