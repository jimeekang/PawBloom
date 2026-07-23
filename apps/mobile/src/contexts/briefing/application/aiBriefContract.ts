import { hasRequiredDisclaimer, type AiBrief } from "../domain/aiBrief";

// Validates the generate-ai-brief edge function response before it reaches
// the UI. A brief without the required safety disclaimer is rejected outright
// (AI_SAFETY.md: every briefing must carry the not-a-diagnosis notice).
export function parseGenerateAiBriefResponse(input: unknown, petId: string): AiBrief {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Malformed brief response");
  }

  const { briefId, payload } = input as Record<string, unknown>;
  if (typeof briefId !== "string" || briefId.length === 0 || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Malformed brief response");
  }

  const { rangeDays, highlights, questionsForVet, disclaimer } = payload as Record<string, unknown>;
  const range = rangeDays === 3 || rangeDays === 7 || rangeDays === 14 ? rangeDays : null;
  if (range === null || !isStringArray(highlights) || highlights.length === 0 || !isStringArray(questionsForVet) || typeof disclaimer !== "string") {
    throw new Error("Malformed brief response");
  }

  const brief: AiBrief = { id: briefId, petId, rangeDays: range, highlights, questionsForVet, disclaimer };
  if (!hasRequiredDisclaimer(brief)) {
    throw new Error("Generated brief is missing the required disclaimer");
  }
  return brief;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
