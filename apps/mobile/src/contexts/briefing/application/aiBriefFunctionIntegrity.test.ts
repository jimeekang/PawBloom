declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as { readFileSync(path: string, encoding: "utf8"): string };
const { AiBriefRequestError, parseAiBriefRequest } = require("../../../../../../supabase/functions/generate-ai-brief/contract.ts") as {
  AiBriefRequestError: new (message: string) => Error;
  parseAiBriefRequest(input: unknown): { petId: string; rangeDays: 3 | 7 | 14; language: "en" | "ko" };
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

for (const rangeDays of [3, 7, 14] as const) {
  const parsed = parseAiBriefRequest({ petId: "  pet-1  ", rangeDays });
  assert(parsed.petId === "pet-1", "the brief request parser must normalize the pet id");
  assert(parsed.rangeDays === rangeDays, `the brief request parser must accept ${rangeDays} days`);
}

for (const rangeDays of [undefined, null, 0, 2, 4, 8, 13, 15, 3.5, "3", "7", true, {}, [], Number.NaN, Number.POSITIVE_INFINITY]) {
  let thrown: unknown;
  try {
    parseAiBriefRequest({ petId: "pet-1", rangeDays });
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof AiBriefRequestError, `the brief request parser must reject rangeDays=${String(rangeDays)}`);
}

assert(parseAiBriefRequest({ petId: "pet-1", rangeDays: 7 }).language === "en", "older clients without a language must keep English briefs");
for (const language of ["en", "ko"] as const) {
  assert(parseAiBriefRequest({ petId: "pet-1", rangeDays: 7, language }).language === language, `the brief request parser must accept language=${language}`);
}

for (const language of ["kr", "EN", "Ko", "", "ja", 1, true, {}, [], null]) {
  let thrown: unknown;
  try {
    parseAiBriefRequest({ petId: "pet-1", rangeDays: 7, language });
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof AiBriefRequestError, `the brief request parser must reject language=${String(language)}`);
}

for (const input of [null, undefined, [], {}, { petId: "", rangeDays: 7 }, { petId: "   ", rangeDays: 7 }]) {
  let thrown: unknown;
  try {
    parseAiBriefRequest(input);
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof AiBriefRequestError, "the brief request parser must reject malformed request bodies");
}

const source = readFileSync(`${process.cwd()}/supabase/functions/generate-ai-brief/index.ts`, "utf8");
for (const required of [
  "parseAiBriefRequest(await readJson<unknown>(request))",
  "const until = new Date().toISOString()",
  ".lte(\"occurred_at\", until)",
  ".lte(\"scheduled_at\", until)",
  "if (entriesResult.error) failSourceQuery(\"diary entries\", entriesResult.error)",
  "if (dosesResult.error) failSourceQuery(\"medication doses\", dosesResult.error)",
  ".catch((error: unknown) => failSourceQuery(\"source records\", error))",
  "if (error instanceof AiBriefSourceError) return errorResponse(error.message, 500)",
]) {
  assert(source.includes(required), `generate-ai-brief source integrity guard is missing: ${required}`);
}

assert(!source.includes("const [{ data: entries }, { data: doses }]"), "source-query errors must not be discarded while destructuring data");

// C7: the edge function must render language-branched copy, and every
// disclaimer it can emit must pass the client-side safety validator —
// otherwise generated briefs would be rejected outright at the contract.
const { hasRequiredDisclaimer } = require("../domain/aiBrief.ts") as {
  hasRequiredDisclaimer(brief: { disclaimer: string } & Record<string, unknown>): boolean;
};

for (const required of ["const copy = briefCopy[body.language]", "disclaimer: copy.disclaimer"]) {
  assert(source.includes(required), `generate-ai-brief must build the payload from language-branched copy: ${required}`);
}

const disclaimers = [...source.matchAll(/disclaimer: "([^"]+)"/g)].map((match) => match[1]);
assert(disclaimers.length >= 2, "generate-ai-brief must define a disclaimer per supported language");
for (const disclaimer of disclaimers) {
  const brief = { id: "b", petId: "p", rangeDays: 7 as const, highlights: ["h"], questionsForVet: [], disclaimer };
  assert(hasRequiredDisclaimer(brief), `edge-function disclaimer must satisfy the client validator: ${disclaimer}`);
}
