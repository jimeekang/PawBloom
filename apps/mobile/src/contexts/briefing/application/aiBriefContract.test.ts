import { parseGenerateAiBriefResponse } from "./aiBriefContract";

const validPayload = {
  rangeDays: 7,
  highlights: ["3 diary records were reviewed."],
  questionsForVet: ["Should the current medication schedule continue unchanged?"],
  disclaimer: "This is a record-based summary, not a diagnosis. Contact a veterinarian for medical decisions.",
};

const parsed = parseGenerateAiBriefResponse({ briefId: "brief-1", createdAt: "2026-07-23", payload: validPayload }, "pet-1");
if (parsed.id !== "brief-1" || parsed.petId !== "pet-1" || parsed.rangeDays !== 7 || parsed.highlights.length !== 1) {
  throw new Error("a valid edge function response must parse into an AiBrief");
}

function expectThrow(input: unknown, label: string) {
  try {
    parseGenerateAiBriefResponse(input, "pet-1");
  } catch {
    return;
  }
  throw new Error(label);
}

expectThrow(
  { briefId: "brief-2", payload: { ...validPayload, disclaimer: "Trust this fully." } },
  "a brief without the required safety disclaimer must be rejected",
);
expectThrow(
  { briefId: "brief-3", payload: { ...validPayload, rangeDays: 30 } },
  "an unsupported range must be rejected",
);
expectThrow(
  { briefId: "brief-4", payload: { ...validPayload, highlights: [] } },
  "an empty highlights list must be rejected",
);
expectThrow({ payload: validPayload }, "a response without briefId must be rejected");
